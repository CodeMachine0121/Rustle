use thiserror::Error;

use crate::vault_entry::VaultEntry;
use crate::vault_name::{VaultPathError, WorkspaceName};

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum WorkspaceRepositoryError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
    #[error("'{0}' already exists")]
    AlreadyExists(String),
    #[error("could not read '{folder}': {reason}")]
    Unreadable { folder: String, reason: String },
    #[error("could not create '{workspace}': {reason}")]
    Unwritable { workspace: String, reason: String },
}

/// The vault's folders as they are on disk. A folder that does not exist
/// lists as empty.
pub trait WorkspaceRepository {
    fn vault_entries(&self) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError>;
    fn workspace_entries(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError>;
    fn create(&self, workspace: &WorkspaceName) -> Result<(), WorkspaceRepositoryError>;
}
