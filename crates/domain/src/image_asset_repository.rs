use thiserror::Error;

use crate::vault_name::{ImageFileName, VaultPathError, WorkspaceName};

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ImageAssetRepositoryError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
    #[error("'{image}' does not exist")]
    NotFound { image: String },
    #[error("could not read '{image}': {reason}")]
    Unreadable { image: String, reason: String },
    #[error("could not write '{image}': {reason}")]
    Unwritable { image: String, reason: String },
    #[error("'{image}' already exists")]
    AlreadyExists { image: String },
}

/// Image files in a workspace's images folder.
pub trait ImageAssetRepository {
    /// Creates the image, and the images folder when it is missing; it never
    /// replaces an existing file.
    fn create(
        &self,
        workspace: &WorkspaceName,
        image: &ImageFileName,
        bytes: &[u8],
    ) -> Result<(), ImageAssetRepositoryError>;

    fn read(
        &self,
        workspace: &WorkspaceName,
        image: &ImageFileName,
    ) -> Result<Vec<u8>, ImageAssetRepositoryError>;
}
