use rustle_domain::{VaultEntry, WorkspaceName, WorkspaceRepository, WorkspaceRepositoryError};
use serde::Serialize;

/// What deleting a workspace takes with it, counted on disk.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceContents {
    pub article_count: usize,
    pub image_count: usize,
}

pub struct CountWorkspaceContents<'a, Workspaces> {
    workspaces: &'a Workspaces,
}

impl<'a, Workspaces: WorkspaceRepository> CountWorkspaceContents<'a, Workspaces> {
    pub fn new(workspaces: &'a Workspaces) -> Self {
        Self { workspaces }
    }

    /// Articles directly in the folder and images directly in its images
    /// folder, read from disk now rather than taken from any earlier list.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<WorkspaceContents, WorkspaceRepositoryError> {
        let articles = self.workspaces.workspace_entries(workspace)?;
        let images = self.workspaces.image_entries(workspace)?;
        Ok(WorkspaceContents {
            article_count: articles.iter().filter_map(VaultEntry::as_article).count(),
            image_count: images.iter().filter_map(VaultEntry::as_image).count(),
        })
    }
}
