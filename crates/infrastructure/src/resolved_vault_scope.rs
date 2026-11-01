use std::fs;
use std::path::{Path, PathBuf};

use rustle_domain::{ArticleFileName, ImageFileName, VaultPathError, VaultScope, WorkspaceName};

/// [`VaultScope`] plus symlink resolution: the real location of every
/// returned path is inside the real vault root. Paths that do not exist
/// yet are judged by their nearest existing ancestor.
#[derive(Debug, Clone)]
pub struct ResolvedVaultScope {
    scope: VaultScope,
}

impl ResolvedVaultScope {
    pub fn new(scope: VaultScope) -> Self {
        Self { scope }
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

    fn confine(&self, path: PathBuf, requested: &str) -> Result<PathBuf, VaultPathError> {
        let real_root = Self::resolve_existing_ancestor(self.scope.root());
        let real_path = Self::resolve_existing_ancestor(&path);
        if real_path.starts_with(&real_root) {
            Ok(real_path)
        } else {
            Err(VaultPathError::OutsideVault {
                rejected: requested.to_owned(),
            })
        }
    }

    fn resolve_existing_ancestor(path: &Path) -> PathBuf {
        path.ancestors()
            .find_map(|ancestor| {
                let real_ancestor = fs::canonicalize(ancestor).ok()?;
                let missing_tail = path.strip_prefix(ancestor).ok()?;
                Some(real_ancestor.join(missing_tail))
            })
            .unwrap_or_else(|| path.to_path_buf())
    }
}
