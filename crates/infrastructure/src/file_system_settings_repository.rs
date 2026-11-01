use std::fs;
use std::io;
use std::path::Path;

use rustle_domain::{Settings, SettingsError, SettingsRepository};
use serde_json::{Map, Value};

use crate::atomic_file::write_atomically;
use crate::resolved_vault_scope::ResolvedVaultScope;

/// Stores settings in `<vault>/.rustle/settings.json`. Keys written by a
/// newer or older Rustle are carried over untouched on save. The location
/// is checked against the vault on every call, so a settings folder that
/// links out of the vault is refused whenever it appears.
#[derive(Debug, Clone)]
pub struct FileSystemSettingsRepository {
    vault: ResolvedVaultScope,
}

impl FileSystemSettingsRepository {
    pub fn in_vault(vault: ResolvedVaultScope) -> Self {
        Self { vault }
    }

    fn read_document(settings_file: &Path) -> Result<Option<Map<String, Value>>, SettingsError> {
        let text = match fs::read_to_string(settings_file) {
            Ok(text) => text,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(SettingsError::Unreadable(error.to_string())),
        };
        serde_json::from_str(&text)
            .map(Some)
            .map_err(|error| SettingsError::Unreadable(error.to_string()))
    }

    fn write_document(settings_file: &Path, document: &Map<String, Value>) -> io::Result<()> {
        let text = serde_json::to_string_pretty(document)? + "\n";
        if let Some(folder) = settings_file.parent() {
            fs::create_dir_all(folder)?;
        }
        write_atomically(settings_file, text.as_bytes())
    }
}

impl SettingsRepository for FileSystemSettingsRepository {
    fn load(&self) -> Result<Settings, SettingsError> {
        let settings_file = self.vault.settings_file_path()?;
        let Some(document) = Self::read_document(&settings_file)? else {
            return Ok(Settings::default());
        };
        serde_json::from_value(Value::Object(document))
            .map_err(|error| SettingsError::Unreadable(error.to_string()))
    }

    fn save(&self, settings: &Settings) -> Result<(), SettingsError> {
        let settings_file = self.vault.settings_file_path()?;
        let mut document = Self::read_document(&settings_file)?.unwrap_or_default();
        if let Value::Object(known_fields) = serde_json::to_value(settings)
            .map_err(|error| SettingsError::Unwritable(error.to_string()))?
        {
            document.extend(known_fields);
        }
        Self::write_document(&settings_file, &document)
            .map_err(|error| SettingsError::Unwritable(error.to_string()))
    }
}
