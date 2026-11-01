use rustle_application::{CreateWorkspace, CreateWorkspaceOutcome};
use rustle_infrastructure::FileSystemWorkspaceRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn create_workspace(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    name: String,
) -> Result<CreateWorkspaceOutcome, CommandError> {
    Ok(CreateWorkspace::new(workspaces.inner()).execute(&name)?)
}
