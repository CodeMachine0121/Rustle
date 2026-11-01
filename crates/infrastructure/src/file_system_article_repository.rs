use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::path::Path;

use rustle_domain::{
    ArticleFileName, ArticleRepository, ArticleRepositoryError, ArticleWrite, StoredArticle,
    UtcTimestamp, WorkspaceName,
};

use crate::atomic_file::write_atomically_unless_modified;
use crate::resolved_vault_scope::ResolvedVaultScope;

/// Articles as `.md` files in `<vault>/<workspace>/`. Every path is checked
/// against the real vault location, symlinks resolved, before it is read
/// or written; writing through a link therefore replaces its target.
#[derive(Debug, Clone)]
pub struct FileSystemArticleRepository {
    vault: ResolvedVaultScope,
}

impl FileSystemArticleRepository {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
    }
}

impl FileSystemArticleRepository {
    fn write_new_file(path: &Path, text: &str) -> io::Result<()> {
        let mut file = File::options().write(true).create_new(true).open(path)?;
        let written = file
            .write_all(text.as_bytes())
            .and_then(|()| file.sync_all())
            .and_then(|()| Self::sync_folder_of(path));
        if written.is_err() {
            drop(file);
            let _ = fs::remove_file(path);
        }
        written
    }

    #[cfg(unix)]
    fn sync_folder_of(path: &Path) -> io::Result<()> {
        path.parent()
            .map_or(Ok(()), |folder| File::open(folder)?.sync_all())
    }

    #[cfg(not(unix))]
    fn sync_folder_of(_path: &Path) -> io::Result<()> {
        Ok(())
    }
}

impl ArticleRepository for FileSystemArticleRepository {
    fn read(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<StoredArticle, ArticleRepositoryError> {
        let path = self.vault.article_path(workspace, article)?;
        let unreadable = |error: io::Error| ArticleRepositoryError::Unreadable {
            article: format!("{workspace}/{article}"),
            reason: error.to_string(),
        };
        let mut file = File::open(&path).map_err(unreadable)?;
        let modified = file
            .metadata()
            .and_then(|metadata| metadata.modified())
            .map_err(unreadable)?;
        let mut text = String::new();
        file.read_to_string(&mut text).map_err(unreadable)?;
        Ok(StoredArticle {
            text,
            last_modified_at: UtcTimestamp::from(modified).to_string(),
        })
    }

    fn write(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
        text: &str,
        expected_modified_at: &str,
    ) -> Result<ArticleWrite, ArticleRepositoryError> {
        let path = self.vault.article_path(workspace, article)?;
        write_atomically_unless_modified(&path, text.as_bytes(), expected_modified_at).map_err(
            |error| ArticleRepositoryError::Unwritable {
                article: format!("{workspace}/{article}"),
                reason: error.to_string(),
            },
        )
    }

    fn create(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
        text: &str,
    ) -> Result<(), ArticleRepositoryError> {
        let path = self.vault.article_path(workspace, article)?;
        Self::write_new_file(&path, text).map_err(|error| {
            let article = format!("{workspace}/{article}");
            if error.kind() == io::ErrorKind::AlreadyExists {
                ArticleRepositoryError::AlreadyExists { article }
            } else {
                ArticleRepositoryError::Unwritable {
                    article,
                    reason: error.to_string(),
                }
            }
        })
    }
}
