use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ImageConversionError {
    #[error("could not convert the image to PNG: {0}")]
    Unconvertible(String),
}

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait ImageConverter {
    fn convert_to_png(&self, bytes: &[u8]) -> Result<Vec<u8>, ImageConversionError>;
}
