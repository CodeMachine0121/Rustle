use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use rustle_domain::{
    ArticleFileName, VaultEntry, VaultEntryKind, VaultPathError, WorkspaceName,
    WorkspaceRepository, WorkspaceRepositoryError,
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
                Ok(match file_name.into_string() {
                    Ok(name) => {
                        let kind = Self::kind_of(locate(&name));
                        VaultEntry::new(name, kind)
                    }
                    Err(name) => {
                        VaultEntry::new(name.to_string_lossy(), VaultEntryKind::Unreachable)
                    }
                })
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

    fn create(&self, workspace: &WorkspaceName) -> Result<(), WorkspaceRepositoryError> {
        let unwritable = |error: io::Error| WorkspaceRepositoryError::Unwritable {
            workspace: workspace.to_string(),
            reason: error.to_string(),
        };
        fs::create_dir_all(self.vault.root()).map_err(unwritable)?;
        let folder = self.vault.workspace_path(workspace)?;
        fs::create_dir(folder).map_err(|error| match error.kind() {
            io::ErrorKind::AlreadyExists => {
                WorkspaceRepositoryError::AlreadyExists(workspace.to_string())
            }
            _ => unwritable(error),
        })
    }
}
