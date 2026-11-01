use thiserror::Error;

use crate::vault_name::{ArticleFileName, VaultPathError, WorkspaceName};

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum TrashError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
    #[error("could not move '{item}' to the trash: {reason}")]
    NotMoved { item: String, reason: String },
}

/// The system trash, addressed by vault names. Nothing is ever deleted
/// permanently: whatever goes here can be restored from the trash.
#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait Trash {
    fn move_article_to_trash(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<(), TrashError>;

    /// Moves the whole workspace folder, images and every other file in it.
    fn move_workspace_to_trash(&self, workspace: &WorkspaceName) -> Result<(), TrashError>;
}
