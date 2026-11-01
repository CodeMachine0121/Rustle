use rustle_application::{RenameWorkspace, RenameWorkspaceOutcome};
use rustle_domain::WorkspaceName;
use rustle_infrastructure::FileSystemWorkspaceRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn rename_workspace(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    workspace: String,
    new_name: String,
) -> Result<RenameWorkspaceOutcome, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(RenameWorkspace::new(workspaces.inner()).execute(&workspace, &new_name)?)
}
