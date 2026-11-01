use rustle_application::{CountWorkspaceContents, WorkspaceContents};
use rustle_domain::WorkspaceName;
use rustle_infrastructure::FileSystemWorkspaceRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn count_workspace_contents(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    workspace: String,
) -> Result<WorkspaceContents, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(CountWorkspaceContents::new(workspaces.inner()).execute(&workspace)?)
}
