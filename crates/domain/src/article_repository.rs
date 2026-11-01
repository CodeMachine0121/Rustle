use thiserror::Error;

use crate::vault_name::{ArticleFileName, VaultPathError, WorkspaceName};

/// An article file as it is on disk: its full text and when it was last
/// modified (ISO 8601).
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredArticle {
    pub text: String,
    pub last_modified_at: String,
}

/// What a guarded write did: replaced the file, or left it alone because
/// its modification time was no longer the one the caller expected.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ArticleWrite {
    Written { modified_at: String },
    ModifiedElsewhere,
}

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ArticleRepositoryError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
    #[error("could not read '{article}': {reason}")]
    Unreadable { article: String, reason: String },
    #[error("could not write '{article}': {reason}")]
    Unwritable { article: String, reason: String },
}

pub trait ArticleRepository {
    fn read(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<StoredArticle, ArticleRepositoryError>;

    /// Replaces the article's text only if the file was last modified at
    /// `expected_modified_at`; there is deliberately no unguarded write.
    fn write(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
        text: &str,
        expected_modified_at: &str,
    ) -> Result<ArticleWrite, ArticleRepositoryError>;
}
