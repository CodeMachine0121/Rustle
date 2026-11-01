use std::io::Cursor;

use image::{ImageFormat, Rgb, RgbImage};
use rstest::rstest;
use rustle_domain::{ImageConversionError, ImageConverter};
use rustle_infrastructure::RasterImageConverter;

fn picture() -> RgbImage {
    RgbImage::from_fn(3, 2, |x, y| Rgb([x as u8 * 80, y as u8 * 120, 200]))
}

fn encoded(format: ImageFormat) -> Vec<u8> {
    let mut bytes = Cursor::new(Vec::new());
    picture().write_to(&mut bytes, format).expect("encodable");
    bytes.into_inner()
}

#[rstest]
#[case::jpeg(ImageFormat::Jpeg)]
#[case::bmp(ImageFormat::Bmp)]
#[case::tiff(ImageFormat::Tiff)]
#[case::webp(ImageFormat::WebP)]
#[case::gif(ImageFormat::Gif)]
fn converts_a_raster_image_to_a_png_of_the_same_size(#[case] format: ImageFormat) {
    let png = RasterImageConverter
        .convert_to_png(&encoded(format))
        .expect("converted");

    assert_eq!(image::guess_format(&png).expect("known"), ImageFormat::Png);
    let decoded = image::load_from_memory(&png).expect("decodable");
    assert_eq!((decoded.width(), decoded.height()), (3, 2));
}

#[test]
fn keeps_the_pixels_of_a_lossless_image() {
    let png = RasterImageConverter
        .convert_to_png(&encoded(ImageFormat::Bmp))
        .expect("converted");

    assert_eq!(
        image::load_from_memory(&png).expect("decodable").to_rgb8(),
        picture()
    );
}

#[test]
fn bytes_that_are_no_image_cannot_be_converted() {
    let result = RasterImageConverter.convert_to_png(b"\xff\xd8\xff not really a jpeg");

    assert!(matches!(
        result,
        Err(ImageConversionError::Unconvertible(_))
    ));
}
