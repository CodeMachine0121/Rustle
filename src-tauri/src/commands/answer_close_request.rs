use tauri::{Runtime, State, WebviewWindow};

use crate::command_error::CommandError;
use crate::window_close_guard::WindowCloseGuard;

#[tauri::command]
pub fn answer_close_request<R: Runtime>(
    window: WebviewWindow<R>,
    guard: State<'_, WindowCloseGuard>,
    close: bool,
) -> Result<(), CommandError> {
    guard.answered();
    if close {
        window.destroy().map_err(CommandError::unexpected)?;
    }
    Ok(())
}
