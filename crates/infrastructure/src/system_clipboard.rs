use std::fs;

use clipboard_rs::{Clipboard as _, ClipboardContext};
use rustle_domain::{Clipboard, ClipboardError};

const PICTURE_FORMATS: [&str; 4] = ["public.png", "public.tiff", "PNG", "image/png"];

/// The operating system's clipboard. Copied files win over a picture,
/// because a copied file also puts its icon on the clipboard as a picture.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClipboard;

impl Clipboard for SystemClipboard {
    fn image_candidates(&self) -> Result<Vec<Vec<u8>>, ClipboardError> {
        let unreadable =
            |error: &dyn std::fmt::Display| ClipboardError::Unreadable(error.to_string());
        let clipboard = ClipboardContext::new().map_err(|error| unreadable(&error))?;
        let files = clipboard.get_files().unwrap_or_default();
        if !files.is_empty() {
            return files
                .iter()
                .map(|file| fs::read(file).map_err(|error| unreadable(&error)))
                .collect();
        }
        Ok(PICTURE_FORMATS
            .iter()
            .find_map(|format| clipboard.get_buffer(format).ok())
            .filter(|picture| !picture.is_empty())
            .into_iter()
            .collect())
    }
}
