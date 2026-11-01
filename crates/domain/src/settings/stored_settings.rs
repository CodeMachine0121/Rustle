use serde::Deserialize;
use serde::de::IgnoredAny;

use crate::interface_language::InterfaceLanguage;

use super::{
    IndentationSettings, IndentationStyle, LastOpenedSettings, PreviewPanelSettings, Settings,
    SidebarSection, SidebarSettings,
};

/// A value as found in the file: either understood, or anything else.
#[derive(Deserialize)]
#[serde(untagged)]
enum Tolerant<T> {
    Understood(T),
    NotUnderstood(IgnoredAny),
}

impl<T> Default for Tolerant<T> {
    fn default() -> Self {
        Self::NotUnderstood(IgnoredAny)
    }
}

impl<T> Tolerant<T> {
    fn or(self, fallback: T) -> T {
        match self {
            Self::Understood(value) => value,
            Self::NotUnderstood(_) => fallback,
        }
    }
}

/// The settings file as written, possibly by hand: every field optional and
/// of any type, so one bad value never costs the others.
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub(super) struct StoredSettings {
    indentation: Tolerant<StoredIndentation>,
    preview_panel: Tolerant<StoredPreviewPanel>,
    last_opened: Tolerant<StoredLastOpened>,
    interface_language: Tolerant<Option<InterfaceLanguage>>,
    sidebar: Tolerant<StoredSidebar>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct StoredIndentation {
    style: Tolerant<IndentationStyle>,
    width: Tolerant<u8>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct StoredPreviewPanel {
    is_open: Tolerant<bool>,
    width_ratio: Tolerant<f64>,
    toggle_shortcut: Tolerant<Option<String>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct StoredLastOpened {
    workspace: Tolerant<Option<String>>,
    article: Tolerant<Option<String>>,
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct StoredSidebar {
    collapsed_sections: Tolerant<Vec<Tolerant<SidebarSection>>>,
}

impl From<StoredSidebar> for SidebarSettings {
    fn from(stored: StoredSidebar) -> Self {
        let mut collapsed_sections = Vec::new();
        for section in stored.collapsed_sections.or_default() {
            if let Tolerant::Understood(section) = section
                && !collapsed_sections.contains(&section)
            {
                collapsed_sections.push(section);
            }
        }
        Self { collapsed_sections }
    }
}

impl From<StoredSettings> for Settings {
    fn from(stored: StoredSettings) -> Self {
        let indentation = stored.indentation.or_default();
        let preview_panel = stored.preview_panel.or_default();
        let last_opened = stored.last_opened.or_default();
        let defaults = Settings::default();
        Self {
            indentation: IndentationSettings {
                style: indentation.style.or(defaults.indentation.style),
                width: indentation.width.or(defaults.indentation.width),
            }
            .normalized(),
            preview_panel: PreviewPanelSettings {
                is_open: preview_panel.is_open.or(defaults.preview_panel.is_open),
                width_ratio: preview_panel
                    .width_ratio
                    .or(defaults.preview_panel.width_ratio),
                toggle_shortcut: preview_panel
                    .toggle_shortcut
                    .or(None)
                    .filter(|shortcut| !shortcut.trim().is_empty()),
            }
            .normalized(),
            last_opened: LastOpenedSettings {
                workspace: last_opened.workspace.or(None),
                article: last_opened.article.or(None),
            },
            interface_language: stored.interface_language.or(None),
            sidebar: stored.sidebar.or_default().into(),
        }
    }
}

impl<T: Default> Tolerant<T> {
    fn or_default(self) -> T {
        self.or(T::default())
    }
}
