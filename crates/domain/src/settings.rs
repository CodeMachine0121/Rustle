mod stored_settings;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::interface_language::InterfaceLanguage;
use crate::vault_name::VaultPathError;
use stored_settings::StoredSettings;

/// The settings the app understands. Slices add their own fields here;
/// keys this type does not know are kept by the repository on save. A value
/// of the wrong type or out of range is read as that field's default.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", from = "StoredSettings")]
pub struct Settings {
    pub indentation: IndentationSettings,
    pub preview_panel: PreviewPanelSettings,
    pub last_opened: LastOpenedSettings,
    /// `None` until the user chooses one; the webview then follows the system.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub interface_language: Option<InterfaceLanguage>,
    pub sidebar: SidebarSettings,
    #[serde(skip_serializing_if = "FontSizeSettings::has_no_opinion")]
    pub font_size: FontSizeSettings,
    /// The chosen theme's name as the webview wrote it. Only the webview knows
    /// which themes exist, so an unknown name is kept and judged there.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum IndentationStyle {
    #[default]
    Spaces,
    Tab,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IndentationSettings {
    pub style: IndentationStyle,
    pub width: u8,
}

impl IndentationSettings {
    const DEFAULT_WIDTH: u8 = 2;
    const SENSIBLE_WIDTHS: std::ops::RangeInclusive<u8> = 1..=8;

    fn normalized(self) -> Self {
        if Self::SENSIBLE_WIDTHS.contains(&self.width) {
            self
        } else {
            Self {
                width: Self::DEFAULT_WIDTH,
                ..self
            }
        }
    }
}

impl Default for IndentationSettings {
    fn default() -> Self {
        Self {
            style: IndentationStyle::Spaces,
            width: Self::DEFAULT_WIDTH,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewPanelSettings {
    pub is_open: bool,
    pub width_ratio: f64,
    /// The key combination the user wrote, e.g. `Mod+Alt+K`. `None` when the
    /// file has no usable opinion; the webview then uses its own default.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub toggle_shortcut: Option<String>,
}

impl PreviewPanelSettings {
    const DEFAULT_WIDTH_RATIO: f64 = 0.5;

    fn normalized(self) -> Self {
        let is_strictly_between_zero_and_one = self.width_ratio > 0.0 && self.width_ratio < 1.0;
        if is_strictly_between_zero_and_one {
            self
        } else {
            Self {
                width_ratio: Self::DEFAULT_WIDTH_RATIO,
                ..self
            }
        }
    }
}

impl Default for PreviewPanelSettings {
    fn default() -> Self {
        Self {
            is_open: true,
            width_ratio: Self::DEFAULT_WIDTH_RATIO,
            toggle_shortcut: None,
        }
    }
}

/// Where the user was when the app last closed: names only, never paths.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LastOpenedSettings {
    pub workspace: Option<String>,
    pub article: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SidebarSection {
    Workspaces,
    Status,
    Tags,
}

/// Which sidebar sections the user folded; each named at most once.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SidebarSettings {
    pub collapsed_sections: Vec<SidebarSection>,
}

/// The editor's and the preview's font sizes in pixels, as the webview
/// wrote them. `None` when the file holds no number. The webview alone
/// decides the default, the range and the precision, so the rule is never
/// written twice.
#[derive(Debug, Clone, Copy, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontSizeSettings {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub editor: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preview: Option<f64>,
}

impl FontSizeSettings {
    fn has_no_opinion(&self) -> bool {
        self.editor.is_none() && self.preview.is_none()
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum SettingsError {
    #[error(transparent)]
    OutsideVault(#[from] VaultPathError),
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

#[cfg(test)]
mod tests;
