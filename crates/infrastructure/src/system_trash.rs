use std::path::Path;

use rustle_domain::{ArticleFileName, Trash, TrashError, WorkspaceName};
use trash::TrashContext;

use crate::resolved_vault_scope::ResolvedVaultScope;

/// The operating system's trash. Names are located through the vault
/// scope first, so nothing outside the real vault ever reaches the trash,
/// and a link is trashed as the link, never as what it points to.
#[derive(Debug, Clone)]
pub struct SystemTrash {
    vault: ResolvedVaultScope,
}

impl SystemTrash {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
    }

    fn move_to_trash(location: &Path, item: String) -> Result<(), TrashError> {
        Self::context()
            .delete(location)
            .map_err(|error| TrashError::NotMoved {
                item,
                reason: error.to_string(),
            })
    }

    // Finder, the default on macOS, would ask for permission to automate it.
    #[cfg(target_os = "macos")]
    fn context() -> TrashContext {
        use trash::macos::{DeleteMethod, TrashContextExtMacos};
        let mut context = TrashContext::default();
        context.set_delete_method(DeleteMethod::NsFileManager);
        context
    }

    #[cfg(not(target_os = "macos"))]
    fn context() -> TrashContext {
        TrashContext::default()
    }
}

impl Trash for SystemTrash {
    fn move_article_to_trash(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<(), TrashError> {
        let location = self.vault.article_entry_path(workspace, article)?;
        Self::move_to_trash(&location, format!("{workspace}/{article}"))
    }

    fn move_workspace_to_trash(&self, workspace: &WorkspaceName) -> Result<(), TrashError> {
        let location = self.vault.workspace_entry_path(workspace)?;
        Self::move_to_trash(&location, workspace.to_string())
    }
}
