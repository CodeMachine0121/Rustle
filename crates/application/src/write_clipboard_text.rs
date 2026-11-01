use rustle_domain::{Clipboard, ClipboardError};

pub struct WriteClipboardText<'a, SystemClipboard> {
    clipboard: &'a SystemClipboard,
}

impl<'a, SystemClipboard: Clipboard> WriteClipboardText<'a, SystemClipboard> {
    pub fn new(clipboard: &'a SystemClipboard) -> Self {
        Self { clipboard }
    }

    pub fn execute(&self, text: &str) -> Result<(), ClipboardError> {
        self.clipboard.set_text(text)
    }
}
