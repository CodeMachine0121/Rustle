use serde::Deserialize;
use serde::de::IgnoredAny;

use super::{
    IndentationSettings, IndentationStyle, LastOpenedSettings, PreviewPanelSettings, Settings,
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
}

#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
struct StoredLastOpened {
    workspace: Tolerant<Option<String>>,
    article: Tolerant<Option<String>>,
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
            }
            .normalized(),
            last_opened: LastOpenedSettings {
                workspace: last_opened.workspace.or(None),
                article: last_opened.article.or(None),
            },
        }
    }
}

impl<T: Default> Tolerant<T> {
    fn or_default(self) -> T {
        self.or(T::default())
    }
}
