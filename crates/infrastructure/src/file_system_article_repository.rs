use std::fs::File;
use std::io::{self, Read};

use rustle_domain::{
    ArticleFileName, ArticleRepository, ArticleRepositoryError, StoredArticle, WorkspaceName,
};

use crate::resolved_vault_scope::ResolvedVaultScope;
use crate::utc_timestamp::UtcTimestamp;

/// Articles as `.md` files in `<vault>/<workspace>/`. Every path is checked
/// against the real vault location, symlinks resolved, before it is read.
#[derive(Debug, Clone)]
pub struct FileSystemArticleRepository {
    vault: ResolvedVaultScope,
}

impl FileSystemArticleRepository {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
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
}
