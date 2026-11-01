use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use rustle_domain::{
    ArticleFileName, IMAGES_FOLDER_NAME, ImageFileName, VaultEntry, VaultEntryKind, VaultPathError,
    WorkspaceName, WorkspaceRepository, WorkspaceRepositoryError,
};

use crate::resolved_vault_scope::ResolvedVaultScope;

/// Workspaces as folders directly under the vault root. Each entry is
/// located through the vault scope, so a link counts as what it points to
/// and a link leading out of the vault or nowhere is `Unreachable`.
#[derive(Debug, Clone)]
pub struct FileSystemWorkspaceRepository {
    vault: ResolvedVaultScope,
}

impl FileSystemWorkspaceRepository {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
    }

    fn entries_of(
        folder: &Path,
        locate: impl Fn(&str) -> Result<PathBuf, VaultPathError>,
    ) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError> {
        let unreadable = |error: io::Error| WorkspaceRepositoryError::Unreadable {
            folder: folder.display().to_string(),
            reason: error.to_string(),
        };
        let listing = match fs::read_dir(folder) {
            Ok(listing) => listing,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
            Err(error) => return Err(unreadable(error)),
        };
        listing
            .map(|entry| {
                let file_name = entry.map_err(unreadable)?.file_name();
                let name = file_name.to_string_lossy();
                Ok(VaultEntry::new(name.as_ref(), Self::kind_of(locate(&name))))
            })
            .collect()
    }

    fn kind_of(located: Result<PathBuf, VaultPathError>) -> VaultEntryKind {
        match located.ok().and_then(|path| fs::metadata(path).ok()) {
            Some(metadata) if metadata.is_dir() => VaultEntryKind::Folder,
            Some(metadata) if metadata.is_file() => VaultEntryKind::File,
            _ => VaultEntryKind::Unreachable,
        }
    }
}

impl WorkspaceRepository for FileSystemWorkspaceRepository {
    fn vault_entries(&self) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError> {
        Self::entries_of(self.vault.root(), |name| {
            self.vault.workspace_path(&WorkspaceName::parse(name)?)
        })
    }

    fn workspace_entries(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError> {
        let folder = self.vault.workspace_path(workspace)?;
        Self::entries_of(&folder, |name| {
            self.vault
                .article_path(workspace, &ArticleFileName::parse(name)?)
        })
    }

    fn image_entries(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<Vec<VaultEntry>, WorkspaceRepositoryError> {
        let folder = self
            .vault
            .workspace_path(workspace)?
            .join(IMAGES_FOLDER_NAME);
        Self::entries_of(&folder, |name| {
            self.vault
                .image_path(workspace, &ImageFileName::parse(name)?)
        })
    }

    fn create(&self, workspace: &WorkspaceName) -> Result<(), WorkspaceRepositoryError> {
        let unwritable = |error: io::Error| WorkspaceRepositoryError::Unwritable {
            workspace: workspace.to_string(),
            reason: error.to_string(),
        };
        fs::create_dir_all(self.vault.root()).map_err(unwritable)?;
        let folder = self.vault.workspace_path(workspace)?;
        fs::create_dir(folder).map_err(unwritable)
    }

    fn rename(
        &self,
        workspace: &WorkspaceName,
        new_name: &WorkspaceName,
    ) -> Result<(), WorkspaceRepositoryError> {
        let not_renamed = |reason: String| WorkspaceRepositoryError::NotRenamed {
            workspace: workspace.to_string(),
            new_name: new_name.to_string(),
            reason,
        };
        let from = self.vault.workspace_entry_path(workspace)?;
        let to = self.vault.workspace_entry_path(new_name)?;
        if fs::symlink_metadata(&to).is_ok() {
            return Err(not_renamed(
                "a folder or file with that name exists".to_owned(),
            ));
        }
        fs::rename(from, to).map_err(|error| not_renamed(error.to_string()))
    }
}
