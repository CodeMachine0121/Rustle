use thiserror::Error;

use crate::vault_name::{ArticleFileName, VaultPathError, WorkspaceName};

/// An article file as it is on disk: its full text and when it was last
/// modified (ISO 8601).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredArticle {
    pub text: String,
    pub last_modified_at: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ArticleRepositoryError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
    #[error("could not read '{article}': {reason}")]
    Unreadable { article: String, reason: String },
}

pub trait ArticleRepository {
    fn read(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<StoredArticle, ArticleRepositoryError>;
}
