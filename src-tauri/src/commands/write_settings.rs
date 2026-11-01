use rustle_domain::{Settings, SettingsRepository};
use rustle_infrastructure::FileSystemSettingsRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn write_settings(
    repository: State<'_, FileSystemSettingsRepository>,
    settings: Settings,
) -> Result<(), CommandError> {
    Ok(repository.save(&settings)?)
}
