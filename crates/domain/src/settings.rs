use serde::{Deserialize, Serialize};
use thiserror::Error;

/// The settings the app understands. Slices add their own fields here;
/// keys this type does not know are kept by the repository on save.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SettingsError {
    #[error("could not read settings: {0}")]
    Unreadable(String),
    #[error("could not write settings: {0}")]
    Unwritable(String),
}

pub trait SettingsRepository {
    /// A missing settings file yields the defaults.
    fn load(&self) -> Result<Settings, SettingsError>;
    fn save(&self, settings: &Settings) -> Result<(), SettingsError>;
}
