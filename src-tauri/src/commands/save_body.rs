use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn save_body() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::SaveBody))
}
