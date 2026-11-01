use rustle_domain::{Settings, SettingsError, SettingsRepository};

pub struct ReadSettings<'a, Repository> {
    settings: &'a Repository,
}

impl<'a, Repository: SettingsRepository> ReadSettings<'a, Repository> {
    pub fn new(settings: &'a Repository) -> Self {
        Self { settings }
    }

    /// A settings file that cannot be understood is read as no settings
    /// file, so a broken file never keeps the app from opening.
    pub fn execute(&self) -> Result<Settings, SettingsError> {
        match self.settings.load() {
            Err(SettingsError::Unreadable(_)) => Ok(Settings::default()),
            other => other,
        }
    }
}
