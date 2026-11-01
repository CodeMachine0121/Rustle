use rustle_application::{ListWorkspaces, WorkspaceSummary};
use rustle_infrastructure::FileSystemWorkspaceRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn list_workspaces(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
) -> Result<Vec<WorkspaceSummary>, CommandError> {
    Ok(ListWorkspaces::new(workspaces.inner()).execute()?)
}
