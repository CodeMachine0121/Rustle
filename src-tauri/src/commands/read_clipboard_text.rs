use rustle_application::{ClipboardText, ReadClipboardText};
use rustle_infrastructure::SystemClipboard;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn read_clipboard_text() -> Result<ClipboardText, CommandError> {
    Ok(ReadClipboardText::new(&SystemClipboard).execute()?)
}
