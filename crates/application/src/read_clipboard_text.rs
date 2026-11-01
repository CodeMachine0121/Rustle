use rustle_domain::{Clipboard, ClipboardError};
use serde::Serialize;

/// The clipboard's text; `None` when it holds none, an empty text included.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardText {
    pub text: Option<String>,
}

pub struct ReadClipboardText<'a, SystemClipboard> {
    clipboard: &'a SystemClipboard,
}

impl<'a, SystemClipboard: Clipboard> ReadClipboardText<'a, SystemClipboard> {
    pub fn new(clipboard: &'a SystemClipboard) -> Self {
        Self { clipboard }
    }

    pub fn execute(&self) -> Result<ClipboardText, ClipboardError> {
        let text = self.clipboard.text()?.filter(|text| !text.is_empty());
        Ok(ClipboardText { text })
    }
}
