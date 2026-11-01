use std::io::Cursor;

use image::ImageFormat;
use rustle_domain::{ImageConversionError, ImageConverter};

/// Decodes any raster format the `image` crate reads and encodes it as PNG.
#[derive(Debug, Clone, Copy, Default)]
pub struct RasterImageConverter;

impl ImageConverter for RasterImageConverter {
    fn convert_to_png(&self, bytes: &[u8]) -> Result<Vec<u8>, ImageConversionError> {
        let unconvertible =
            |error: image::ImageError| ImageConversionError::Unconvertible(error.to_string());
        let decoded = image::load_from_memory(bytes).map_err(unconvertible)?;
        let mut png = Cursor::new(Vec::new());
        decoded
            .write_to(&mut png, ImageFormat::Png)
            .map_err(unconvertible)?;
        Ok(png.into_inner())
    }
}
