use rustle_domain::LanguagePreferences;
use serde::Serialize;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreferredLocales {
    pub locales: Vec<String>,
}

/// What the operating system prefers, for the webview to decide the
/// interface language with when the user has never chosen one.
pub struct ReadPreferredLocales<'a, Preferences> {
    preferences: &'a Preferences,
}

impl<'a, Preferences: LanguagePreferences> ReadPreferredLocales<'a, Preferences> {
    pub fn new(preferences: &'a Preferences) -> Self {
        Self { preferences }
    }

    pub fn execute(&self) -> PreferredLocales {
        PreferredLocales {
            locales: self.preferences.preferred_locales(),
        }
    }
}
