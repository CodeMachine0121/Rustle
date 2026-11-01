use std::fs;
use std::io;

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
        let text = fs::read_to_string(&path).map_err(unreadable)?;
        let modified = fs::metadata(&path)
            .and_then(|metadata| metadata.modified())
            .map_err(unreadable)?;
        Ok(StoredArticle {
            text,
            last_modified_at: UtcTimestamp::from(modified).to_string(),
        })
    }
}
