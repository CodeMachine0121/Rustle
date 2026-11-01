use rustle_application::ReadSettings;
use rustle_domain::Settings;
use rustle_infrastructure::FileSystemSettingsRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn read_settings(
    settings: State<'_, FileSystemSettingsRepository>,
) -> Result<Settings, CommandError> {
    Ok(ReadSettings::new(settings.inner()).execute()?)
}
