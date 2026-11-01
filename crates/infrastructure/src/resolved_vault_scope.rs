use std::fs;
use std::path::{Path, PathBuf};

use rustle_domain::{ArticleFileName, ImageFileName, VaultPathError, VaultScope, WorkspaceName};

/// [`VaultScope`] plus symlink resolution: the real location of every
/// returned path is inside the real vault root. Paths that do not exist
/// yet are judged by their nearest existing ancestor; a link whose target
/// cannot be resolved is rejected.
#[derive(Debug, Clone)]
pub struct ResolvedVaultScope {
    scope: VaultScope,
}

impl ResolvedVaultScope {
    pub fn new(scope: VaultScope) -> Self {
        Self { scope }
    }

    /// The vault folder as configured; it may not exist yet.
    pub fn root(&self) -> &Path {
        self.scope.root()
    }

    pub fn workspace_path(&self, workspace: &WorkspaceName) -> Result<PathBuf, VaultPathError> {
        self.confine(self.scope.workspace_path(workspace), workspace.as_str())
    }

    pub fn article_path(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<PathBuf, VaultPathError> {
        self.confine(
            self.scope.article_path(workspace, article),
            &format!("{workspace}/{article}"),
        )
    }

    /// The workspace entry itself rather than what a link points to, for
    /// operations that act on the entry: renaming and trashing.
    pub fn workspace_entry_path(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<PathBuf, VaultPathError> {
        self.entry(self.scope.workspace_path(workspace), workspace.as_str())
    }

    /// The article entry itself rather than what a link points to.
    pub fn article_entry_path(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<PathBuf, VaultPathError> {
        self.entry(
            self.scope.article_path(workspace, article),
            &format!("{workspace}/{article}"),
        )
    }

    pub fn image_path(
        &self,
        workspace: &WorkspaceName,
        image: &ImageFileName,
    ) -> Result<PathBuf, VaultPathError> {
        self.confine(
            self.scope.image_path(workspace, image),
            &format!("{workspace}/{image}"),
        )
    }

    pub fn settings_file_path(&self) -> Result<PathBuf, VaultPathError> {
        let path = self.scope.settings_file_path();
        let requested = path.display().to_string();
        self.confine(path, &requested)
    }

    /// Confined like any other path, then rebuilt from the real parent and
    /// the entry's own name, so a link is not replaced by its target.
    fn entry(&self, path: PathBuf, requested: &str) -> Result<PathBuf, VaultPathError> {
        let outside_vault = || VaultPathError::OutsideVault {
            rejected: requested.to_owned(),
        };
        let (Some(parent), Some(name)) = (path.parent(), path.file_name()) else {
            return Err(outside_vault());
        };
        let real_parent = self.confine(parent.to_path_buf(), requested)?;
        self.confine(path.clone(), requested)?;
        Ok(real_parent.join(name))
    }

    fn confine(&self, path: PathBuf, requested: &str) -> Result<PathBuf, VaultPathError> {
        let outside_vault = || VaultPathError::OutsideVault {
            rejected: requested.to_owned(),
        };
        let real_root =
            Self::resolve_existing_ancestor(self.scope.root()).ok_or_else(outside_vault)?;
        let real_path = Self::resolve_existing_ancestor(&path).ok_or_else(outside_vault)?;
        if real_path.starts_with(&real_root) {
            Ok(real_path)
        } else {
            Err(outside_vault())
        }
    }

    /// Resolves the nearest ancestor that exists on disk, a dangling link
    /// included, and appends the missing tail. `None` when that ancestor
    /// cannot be resolved, so a broken link can never pass as inside.
    fn resolve_existing_ancestor(path: &Path) -> Option<PathBuf> {
        let Some(ancestor) = path
            .ancestors()
            .find(|ancestor| fs::symlink_metadata(ancestor).is_ok())
        else {
            return Some(path.to_path_buf());
        };
        let real_ancestor = fs::canonicalize(ancestor).ok()?;
        let missing_tail = path.strip_prefix(ancestor).ok()?;
        Some(
            real_ancestor
                .components()
                .chain(missing_tail.components())
                .collect(),
        )
    }
}
