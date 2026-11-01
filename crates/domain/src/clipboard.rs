use std::fmt::Display;

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ClipboardError {
    #[error("could not read the clipboard: {0}")]
    Unreadable(String),
    #[error("could not write the clipboard: {0}")]
    Unwritable(String),
}

impl ClipboardError {
    pub fn unreadable(cause: impl Display) -> Self {
        Self::Unreadable(cause.to_string())
    }

    pub fn unwritable(cause: impl Display) -> Self {
        Self::Unwritable(cause.to_string())
    }
}

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait Clipboard {
    /// The contents of every file the clipboard refers to that may be an
    /// image, in order, or else the picture it holds; empty when it holds
    /// neither.
    fn image_candidates(&self) -> Result<Vec<Vec<u8>>, ClipboardError>;

    /// `None` when the clipboard holds no text, for example only a picture.
    fn text(&self) -> Result<Option<String>, ClipboardError>;

    fn set_text(&self, text: &str) -> Result<(), ClipboardError>;
}
