use rustle_domain::{
    WorkspaceNameRejection, WorkspaceNameRequest, WorkspaceRepository, WorkspaceRepositoryError,
};
use serde::Serialize;

use crate::list_workspaces::WorkspaceSummary;

/// A name the user may type wrongly is an expected answer, not an error.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum CreateWorkspaceOutcome {
    Created { workspace: WorkspaceSummary },
    Rejected { reason: WorkspaceNameRejection },
}

pub struct CreateWorkspace<'a, Workspaces> {
    workspaces: &'a Workspaces,
}

impl<'a, Workspaces: WorkspaceRepository> CreateWorkspace<'a, Workspaces> {
    pub fn new(workspaces: &'a Workspaces) -> Self {
        Self { workspaces }
    }

    /// Creates the folder only when the name is accepted; a rejected name
    /// creates nothing.
    pub fn execute(
        &self,
        typed_name: &str,
    ) -> Result<CreateWorkspaceOutcome, WorkspaceRepositoryError> {
        let existing = self.workspaces.vault_entries()?;
        let workspace = match WorkspaceNameRequest::new(typed_name).judge(&existing) {
            Ok(workspace) => workspace,
            Err(reason) => return Ok(CreateWorkspaceOutcome::Rejected { reason }),
        };
        match self.workspaces.create(&workspace) {
            Ok(()) => Ok(CreateWorkspaceOutcome::Created {
                workspace: WorkspaceSummary {
                    name: workspace.to_string(),
                    article_count: 0,
                },
            }),
            Err(WorkspaceRepositoryError::AlreadyExists(_)) => {
                Ok(CreateWorkspaceOutcome::Rejected {
                    reason: WorkspaceNameRejection::AlreadyUsed,
                })
            }
            Err(error) => Err(error),
        }
    }
}
