use rustle_domain::{
    WorkspaceName, WorkspaceNameRejection, WorkspaceNameRequest, WorkspaceRepository,
    WorkspaceRepositoryError,
};
use serde::Serialize;

/// A name the user may type wrongly is an expected answer, not an error.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum RenameWorkspaceOutcome {
    Renamed { workspace: String },
    Rejected { reason: WorkspaceNameRejection },
}

pub struct RenameWorkspace<'a, Workspaces> {
    workspaces: &'a Workspaces,
}

impl<'a, Workspaces: WorkspaceRepository> RenameWorkspace<'a, Workspaces> {
    pub fn new(workspaces: &'a Workspaces) -> Self {
        Self { workspaces }
    }

    /// Renames the folder in place when the new name would be accepted for
    /// a new workspace. The folder's own name counts as taken, so a change
    /// of case alone is rejected like any other used name.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        typed_name: &str,
    ) -> Result<RenameWorkspaceOutcome, WorkspaceRepositoryError> {
        let existing = self.workspaces.vault_entries()?;
        let new_name = match WorkspaceNameRequest::new(typed_name).judge(&existing) {
            Ok(new_name) => new_name,
            Err(reason) => return Ok(RenameWorkspaceOutcome::Rejected { reason }),
        };
        self.workspaces.rename(workspace, &new_name)?;
        Ok(RenameWorkspaceOutcome::Renamed {
            workspace: new_name.to_string(),
        })
    }
}
