use serde::{Deserialize, Serialize};

/// The language Rustle speaks in. It never changes what is written to a file.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum InterfaceLanguage {
    #[serde(rename = "zh")]
    Chinese,
    #[serde(rename = "en")]
    English,
}

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait LanguagePreferences {
    /// The operating system's preferred locales (`zh-Hant-TW`, `en-US`…),
    /// most preferred first. Empty when the system does not say.
    fn preferred_locales(&self) -> Vec<String>;
}
