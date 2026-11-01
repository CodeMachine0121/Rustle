use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn update_metadata() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::UpdateMetadata))
}
