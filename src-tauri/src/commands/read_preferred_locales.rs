use rustle_application::{PreferredLocales, ReadPreferredLocales};
use rustle_infrastructure::SystemLanguagePreferences;

#[tauri::command]
pub fn read_preferred_locales() -> PreferredLocales {
    ReadPreferredLocales::new(&SystemLanguagePreferences).execute()
}
