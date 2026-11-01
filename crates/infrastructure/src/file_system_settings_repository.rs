use std::fs;
use std::io;
use std::path::PathBuf;

use rustle_domain::{Settings, SettingsError, SettingsRepository, VaultPathError};
use serde_json::{Map, Value};

use crate::atomic_file::write_atomically;
use crate::resolved_vault_scope::ResolvedVaultScope;

/// Stores settings in `<vault>/.rustle/settings.json`. Keys written by a
/// newer or older Rustle are carried over untouched on save.
#[derive(Debug, Clone)]
pub struct FileSystemSettingsRepository {
    settings_file: PathBuf,
}

impl FileSystemSettingsRepository {
    pub fn in_vault(vault: &ResolvedVaultScope) -> Result<Self, VaultPathError> {
        Ok(Self {
            settings_file: vault.settings_file_path()?,
        })
    }

    fn read_document(&self) -> Result<Option<Map<String, Value>>, SettingsError> {
        let text = match fs::read_to_string(&self.settings_file) {
            Ok(text) => text,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(SettingsError::Unreadable(error.to_string())),
        };
        serde_json::from_str(&text)
            .map(Some)
            .map_err(|error| SettingsError::Unreadable(error.to_string()))
    }
}

impl SettingsRepository for FileSystemSettingsRepository {
    fn load(&self) -> Result<Settings, SettingsError> {
        let Some(document) = self.read_document()? else {
            return Ok(Settings::default());
        };
        serde_json::from_value(Value::Object(document))
            .map_err(|error| SettingsError::Unreadable(error.to_string()))
    }

    fn save(&self, settings: &Settings) -> Result<(), SettingsError> {
        let unwritable =
            |error: &dyn std::fmt::Display| SettingsError::Unwritable(error.to_string());
        let mut document = self.read_document()?.unwrap_or_default();
        let Value::Object(known_fields) =
            serde_json::to_value(settings).map_err(|error| unwritable(&error))?
        else {
            return Err(SettingsError::Unwritable(
                "settings are not a JSON object".to_owned(),
            ));
        };
        document.extend(known_fields);

        let mut text =
            serde_json::to_string_pretty(&document).map_err(|error| unwritable(&error))?;
        text.push('\n');
        if let Some(folder) = self.settings_file.parent() {
            fs::create_dir_all(folder).map_err(|error| unwritable(&error))?;
        }
        write_atomically(&self.settings_file, text.as_bytes()).map_err(|error| unwritable(&error))
    }
}
