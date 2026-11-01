use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn read_body() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::ReadBody))
}
