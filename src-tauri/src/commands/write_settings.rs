use rustle_application::WriteSettings;
use rustle_domain::Settings;
use rustle_infrastructure::FileSystemSettingsRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn write_settings(
    repository: State<'_, FileSystemSettingsRepository>,
    settings: Settings,
) -> Result<(), CommandError> {
    Ok(WriteSettings::new(repository.inner()).execute(&settings)?)
}
