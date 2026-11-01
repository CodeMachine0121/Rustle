use rustle_domain::LanguagePreferences;

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemLanguagePreferences;

impl LanguagePreferences for SystemLanguagePreferences {
    fn preferred_locales(&self) -> Vec<String> {
        sys_locale::get_locales()
            .filter(|locale| !locale.trim().is_empty())
            .collect()
    }
}
