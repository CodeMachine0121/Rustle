use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn write_settings() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::WriteSettings))
}
