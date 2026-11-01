use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ClipboardError {
    #[error("could not read the clipboard: {0}")]
    Unreadable(String),
}

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait Clipboard {
    /// The contents of every file the clipboard refers to, in order, or else
    /// the picture it holds; empty when it holds neither.
    fn image_candidates(&self) -> Result<Vec<Vec<u8>>, ClipboardError>;
}
