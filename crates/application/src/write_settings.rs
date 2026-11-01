use rustle_domain::{Settings, SettingsError, SettingsRepository};

pub struct WriteSettings<'a, Repository> {
    settings: &'a Repository,
}

impl<'a, Repository: SettingsRepository> WriteSettings<'a, Repository> {
    pub fn new(settings: &'a Repository) -> Self {
        Self { settings }
    }

    pub fn execute(&self, settings: &Settings) -> Result<(), SettingsError> {
        self.settings.save(settings)
    }
}
