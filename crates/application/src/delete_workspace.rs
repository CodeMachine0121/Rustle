use rustle_domain::{
    Trash, TrashError, WorkspaceName, WorkspaceRepository, WorkspaceRepositoryError,
};
use thiserror::Error;

use crate::count_workspace_contents::{CountWorkspaceContents, WorkspaceContents};

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DeleteWorkspaceError {
    #[error(transparent)]
    Workspace(#[from] WorkspaceRepositoryError),
    #[error(transparent)]
    Trash(#[from] TrashError),
}

pub struct DeleteWorkspace<'a, Workspaces, SystemTrash> {
    workspaces: &'a Workspaces,
    trash: &'a SystemTrash,
}

impl<'a, Workspaces, SystemTrash> DeleteWorkspace<'a, Workspaces, SystemTrash>
where
    Workspaces: WorkspaceRepository,
    SystemTrash: Trash,
{
    pub fn new(workspaces: &'a Workspaces, trash: &'a SystemTrash) -> Self {
        Self { workspaces, trash }
    }

    /// Moves the whole folder to the trash and answers with what went, as
    /// counted right before it went.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<WorkspaceContents, DeleteWorkspaceError> {
        let contents = CountWorkspaceContents::new(self.workspaces).execute(workspace)?;
        self.trash.move_workspace_to_trash(workspace)?;
        Ok(contents)
    }
}
