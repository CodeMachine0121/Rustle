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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_only_locale_names_that_say_something() {
        let locales = SystemLanguagePreferences.preferred_locales();

        assert!(locales.iter().all(|locale| !locale.trim().is_empty()));
    }
}
