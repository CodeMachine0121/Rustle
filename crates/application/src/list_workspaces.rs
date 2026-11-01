use rustle_domain::{VaultEntry, WorkspaceRepository, WorkspaceRepositoryError};
use serde::Serialize;

/// One row of the workspace list.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSummary {
    pub name: String,
    /// `None` when the workspace folder cannot be read: it is still listed,
    /// as an unreadable article is, instead of hiding every other workspace.
    pub article_count: Option<usize>,
}

pub struct ListWorkspaces<'a, Workspaces> {
    workspaces: &'a Workspaces,
}

impl<'a, Workspaces: WorkspaceRepository> ListWorkspaces<'a, Workspaces> {
    pub fn new(workspaces: &'a Workspaces) -> Self {
        Self { workspaces }
    }

    /// Workspaces in name order, each with the number of articles it holds,
    /// counted by name without reading any article.
    pub fn execute(&self) -> Result<Vec<WorkspaceSummary>, WorkspaceRepositoryError> {
        let mut entries = self.workspaces.vault_entries()?;
        entries.sort_by(VaultEntry::compare_names);
        entries
            .iter()
            .filter_map(VaultEntry::as_workspace)
            .map(|workspace| {
                let article_count = match self.workspaces.workspace_entries(&workspace) {
                    Ok(entries) => Some(
                        entries
                            .iter()
                            .filter(|entry| entry.as_article().is_some())
                            .count(),
                    ),
                    Err(WorkspaceRepositoryError::Unreadable { .. }) => None,
                    Err(error) => return Err(error),
                };
                Ok(WorkspaceSummary {
                    name: workspace.to_string(),
                    article_count,
                })
            })
            .collect()
    }
}
