use std::fs;
use std::io;

use rustle_domain::{
    ImageAssetRepository, ImageAssetRepositoryError, ImageFileName, WorkspaceName,
};

use crate::atomic_file::create_new_durably;
use crate::resolved_vault_scope::ResolvedVaultScope;

/// Images as files in `<vault>/<workspace>/images/`. The folder and the
/// file are each checked against the real vault location, symlinks
/// resolved, before they are created or read.
#[derive(Debug, Clone)]
pub struct FileSystemImageAssetRepository {
    vault: ResolvedVaultScope,
}

impl FileSystemImageAssetRepository {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
    }
}

impl ImageAssetRepository for FileSystemImageAssetRepository {
    fn create(
        &self,
        workspace: &WorkspaceName,
        image: &ImageFileName,
        bytes: &[u8],
    ) -> Result<(), ImageAssetRepositoryError> {
        let image_name = format!("{workspace}/{}", image.relative_path());
        let unwritable = |error: io::Error| ImageAssetRepositoryError::Unwritable {
            image: image_name.clone(),
            reason: error.to_string(),
        };
        if let Err(error) = fs::create_dir(self.vault.images_folder_path(workspace)?)
            && error.kind() != io::ErrorKind::AlreadyExists
        {
            return Err(unwritable(error));
        }
        let path = self.vault.image_path(workspace, image)?;
        create_new_durably(&path, bytes).map_err(|error| {
            if error.kind() == io::ErrorKind::AlreadyExists {
                ImageAssetRepositoryError::AlreadyExists {
                    image: image_name.clone(),
                }
            } else {
                unwritable(error)
            }
        })
    }

    fn read(
        &self,
        workspace: &WorkspaceName,
        image: &ImageFileName,
    ) -> Result<Vec<u8>, ImageAssetRepositoryError> {
        let image_name = format!("{workspace}/{}", image.relative_path());
        let path = self.vault.image_path(workspace, image)?;
        fs::read(path).map_err(|error| {
            if error.kind() == io::ErrorKind::NotFound {
                ImageAssetRepositoryError::NotFound { image: image_name }
            } else {
                ImageAssetRepositoryError::Unreadable {
                    image: image_name,
                    reason: error.to_string(),
                }
            }
        })
    }
}
