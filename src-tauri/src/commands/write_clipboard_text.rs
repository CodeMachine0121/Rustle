use rustle_application::WriteClipboardText;
use rustle_infrastructure::SystemClipboard;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn write_clipboard_text(text: String) -> Result<(), CommandError> {
    Ok(WriteClipboardText::new(&SystemClipboard).execute(&text)?)
}
