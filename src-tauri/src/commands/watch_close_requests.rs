use tauri::State;
use tauri::ipc::Channel;

use crate::window_close_guard::WindowCloseGuard;

#[tauri::command]
pub fn watch_close_requests(guard: State<'_, WindowCloseGuard>, on_close_request: Channel<()>) {
    guard.watch(on_close_request);
}
