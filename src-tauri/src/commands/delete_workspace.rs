use rustle_application::{DeleteWorkspace, WorkspaceContents};
use rustle_domain::WorkspaceName;
use rustle_infrastructure::{FileSystemWorkspaceRepository, SystemTrash};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn delete_workspace(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    trash: State<'_, SystemTrash>,
    workspace: String,
) -> Result<WorkspaceContents, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(DeleteWorkspace::new(workspaces.inner(), trash.inner()).execute(&workspace)?)
}
