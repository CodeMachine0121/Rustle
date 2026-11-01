use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn save_clipboard_image() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::SaveClipboardImage))
}
