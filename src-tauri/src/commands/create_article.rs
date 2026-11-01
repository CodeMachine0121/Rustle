use crate::channel::Channel;
use crate::command_error::CommandError;

#[tauri::command]
pub fn create_article() -> Result<(), CommandError> {
    Err(CommandError::not_implemented(Channel::CreateArticle))
}
