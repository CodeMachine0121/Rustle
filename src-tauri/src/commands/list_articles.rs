use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn list_articles() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::ListArticles))
}
