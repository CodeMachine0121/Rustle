/// How a pasted image is stored: kept byte for byte, or converted to PNG
/// because a still raster image loses nothing that way.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImageStorage {
    Original { extension: &'static str },
    ConvertToPng,
}

pub const PNG_EXTENSION: &str = "png";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ImageFormat {
    Png,
    Jpeg,
    Gif,
    Bmp,
    Tiff,
    WebP,
    Svg,
}

/// Bytes from the clipboard that are recognisably an image Rustle stores.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PastedImage {
    bytes: Vec<u8>,
    format: ImageFormat,
}

const PNG_SIGNATURE: &[u8] = b"\x89PNG\r\n\x1a\n";
const JPEG_SIGNATURE: &[u8] = b"\xff\xd8\xff";
const GIF_SIGNATURES: [&[u8]; 2] = [b"GIF87a", b"GIF89a"];
const BMP_SIGNATURE: &[u8] = b"BM";
const TIFF_SIGNATURES: [&[u8]; 2] = [b"II*\0", b"MM\0*"];
const SVG_SNIFF_LENGTH: usize = 4096;

impl PastedImage {
    /// How many leading bytes decide whether bytes are a recognised image.
    pub const HEADER_LENGTH: usize = SVG_SNIFF_LENGTH;

    /// Whether bytes starting with this header would be recognised, so a
    /// file that is not an image need not be read in full.
    pub fn has_image_header(header: &[u8]) -> bool {
        ImageFormat::of(header).is_some()
    }

    /// `None` for anything that is not one of the recognised image formats.
    pub fn recognize(bytes: Vec<u8>) -> Option<Self> {
        let format = ImageFormat::of(&bytes)?;
        Some(Self { bytes, format })
    }

    pub fn storage(&self) -> ImageStorage {
        let original = |extension| ImageStorage::Original { extension };
        match self.format {
            ImageFormat::Png => original(PNG_EXTENSION),
            ImageFormat::Svg => original("svg"),
            ImageFormat::Gif if GifFrames::count(&self.bytes) > 1 => original("gif"),
            ImageFormat::WebP if Self::is_animated_webp(&self.bytes) => original("webp"),
            ImageFormat::Jpeg
            | ImageFormat::Gif
            | ImageFormat::Bmp
            | ImageFormat::Tiff
            | ImageFormat::WebP => ImageStorage::ConvertToPng,
        }
    }

    pub fn bytes(&self) -> &[u8] {
        &self.bytes
    }

    fn is_animated_webp(bytes: &[u8]) -> bool {
        const ANIMATION_FLAG: u8 = 0b0000_0010;
        bytes.get(12..16) == Some(b"VP8X")
            && bytes
                .get(20)
                .is_some_and(|flags| flags & ANIMATION_FLAG != 0)
    }
}

impl ImageFormat {
    fn of(bytes: &[u8]) -> Option<Self> {
        let starts_with_any = |signatures: &[&[u8]]| {
            signatures
                .iter()
                .any(|signature| bytes.starts_with(signature))
        };
        if bytes.starts_with(PNG_SIGNATURE) {
            Some(Self::Png)
        } else if bytes.starts_with(JPEG_SIGNATURE) {
            Some(Self::Jpeg)
        } else if starts_with_any(&GIF_SIGNATURES) {
            Some(Self::Gif)
        } else if starts_with_any(&TIFF_SIGNATURES) {
            Some(Self::Tiff)
        } else if bytes.starts_with(BMP_SIGNATURE) {
            Some(Self::Bmp)
        } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
            Some(Self::WebP)
        } else if Self::looks_like_svg(bytes) {
            Some(Self::Svg)
        } else {
            None
        }
    }

    fn looks_like_svg(bytes: &[u8]) -> bool {
        let head = &bytes[..bytes.len().min(SVG_SNIFF_LENGTH)];
        let text = String::from_utf8_lossy(head);
        let text = text.trim_start_matches('\u{feff}').trim_start();
        text.starts_with('<') && text.contains("<svg")
    }
}

/// Walks a GIF's block structure and counts its image frames, stopping at
/// the trailer or at the first block it cannot read.
struct GifFrames<'a> {
    bytes: &'a [u8],
    position: usize,
}

impl<'a> GifFrames<'a> {
    const HEADER_LENGTH: usize = 13;
    const IMAGE_DESCRIPTOR: u8 = 0x2c;
    const EXTENSION: u8 = 0x21;
    const IMAGE_DESCRIPTOR_LENGTH: usize = 10;
    const COLOR_TABLE_FLAG: u8 = 0x80;

    fn count(bytes: &'a [u8]) -> usize {
        let Some(&screen_flags) = bytes.get(10) else {
            return 0;
        };
        let mut frames = Self {
            bytes,
            position: Self::HEADER_LENGTH + Self::color_table_length(screen_flags),
        };
        let mut count = 0;
        while let Some(&introducer) = frames.bytes.get(frames.position) {
            let read = match introducer {
                Self::IMAGE_DESCRIPTOR => frames.skip_image().map(|()| count += 1),
                Self::EXTENSION => {
                    frames.position += 2;
                    frames.skip_sub_blocks()
                }
                _ => None,
            };
            if read.is_none() {
                break;
            }
        }
        count
    }

    fn color_table_length(flags: u8) -> usize {
        if flags & Self::COLOR_TABLE_FLAG == 0 {
            0
        } else {
            3 << ((flags & 0b111) + 1)
        }
    }

    fn skip_image(&mut self) -> Option<()> {
        let &flags = self
            .bytes
            .get(self.position + Self::IMAGE_DESCRIPTOR_LENGTH - 1)?;
        self.position += Self::IMAGE_DESCRIPTOR_LENGTH + Self::color_table_length(flags) + 1;
        self.skip_sub_blocks()
    }

    fn skip_sub_blocks(&mut self) -> Option<()> {
        loop {
            let &length = self.bytes.get(self.position)?;
            self.position += 1 + usize::from(length);
            if length == 0 {
                return Some(());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    const SCREEN_WITHOUT_COLOR_TABLE: [u8; 7] = [1, 0, 1, 0, 0x00, 0, 0];
    const GRAPHIC_CONTROL: [u8; 8] = [0x21, 0xf9, 4, 0, 10, 0, 0, 0];
    const FRAME: [u8; 15] = [0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 2, 2, 0x4c, 0x01, 0];

    fn gif(frames: usize) -> Vec<u8> {
        let mut bytes = b"GIF89a".to_vec();
        bytes.extend(SCREEN_WITHOUT_COLOR_TABLE);
        for _ in 0..frames {
            bytes.extend(GRAPHIC_CONTROL);
            bytes.extend(FRAME);
        }
        bytes.push(0x3b);
        bytes
    }

    fn gif_with_color_tables(frames: usize) -> Vec<u8> {
        let mut bytes = b"GIF89a".to_vec();
        bytes.extend([1, 0, 1, 0, 0x80, 0, 0]);
        bytes.extend([0; 6]);
        for _ in 0..frames {
            bytes.extend([0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x80]);
            bytes.extend([0; 6]);
            bytes.extend([2, 2, 0x4c, 0x01, 0]);
        }
        bytes.push(0x3b);
        bytes
    }

    fn webp(chunk: &[u8; 4], flags: u8) -> Vec<u8> {
        let mut bytes = b"RIFF\0\0\0\0WEBP".to_vec();
        bytes.extend(chunk);
        bytes.extend([10, 0, 0, 0, flags, 0, 0, 0]);
        bytes
    }

    fn storage_of(bytes: Vec<u8>) -> ImageStorage {
        PastedImage::recognize(bytes)
            .expect("recognised image")
            .storage()
    }

    fn original(extension: &'static str) -> ImageStorage {
        ImageStorage::Original { extension }
    }

    #[test]
    fn keeps_a_png_as_it_is() {
        let png = [PNG_SIGNATURE, b"rest of the file"].concat();

        let image = PastedImage::recognize(png.clone()).expect("png");

        assert_eq!(image.storage(), original("png"));
        assert_eq!(image.bytes(), png);
    }

    #[rstest]
    #[case::jpeg(b"\xff\xd8\xff\xe0 jfif".to_vec())]
    #[case::bmp(b"BM\x3a\0\0\0".to_vec())]
    #[case::tiff_little_endian(b"II*\0\x08\0\0\0".to_vec())]
    #[case::tiff_big_endian(b"MM\0*\0\0\0\x08".to_vec())]
    #[case::still_webp(webp(b"VP8 ", 0))]
    #[case::still_extended_webp(webp(b"VP8X", 0b0001_0000))]
    #[case::still_gif(gif(1))]
    #[case::still_gif_with_color_tables(gif_with_color_tables(1))]
    fn converts_a_still_raster_image_to_png(#[case] bytes: Vec<u8>) {
        assert_eq!(storage_of(bytes), ImageStorage::ConvertToPng);
    }

    #[rstest]
    #[case::gif(gif(2))]
    #[case::gif_with_color_tables(gif_with_color_tables(3))]
    fn keeps_an_animated_gif(#[case] bytes: Vec<u8>) {
        assert_eq!(storage_of(bytes), original("gif"));
    }

    #[test]
    fn a_truncated_gif_counts_only_the_frames_it_could_read() {
        let mut bytes = gif(2);
        bytes.truncate(bytes.len() - 8);

        assert_eq!(storage_of(bytes), ImageStorage::ConvertToPng);
    }

    #[test]
    fn a_gif_with_an_unknown_block_stops_counting_there() {
        let mut bytes = b"GIF89a".to_vec();
        bytes.extend(SCREEN_WITHOUT_COLOR_TABLE);
        bytes.extend(FRAME);
        bytes.push(0x99);
        bytes.extend(FRAME);

        assert_eq!(storage_of(bytes), ImageStorage::ConvertToPng);
    }

    #[test]
    fn a_gif_header_alone_has_no_frames() {
        assert_eq!(storage_of(b"GIF89a".to_vec()), ImageStorage::ConvertToPng);
    }

    #[test]
    fn keeps_an_animated_webp() {
        assert_eq!(storage_of(webp(b"VP8X", 0b0000_0010)), original("webp"));
    }

    #[rstest]
    #[case("<svg xmlns=\"http://www.w3.org/2000/svg\"/>")]
    #[case("\u{feff}  <?xml version=\"1.0\"?>\n<svg/>")]
    #[case("<!-- drawn by hand -->\n<svg></svg>")]
    fn keeps_an_svg(#[case] text: &str) {
        assert_eq!(storage_of(text.as_bytes().to_vec()), original("svg"));
    }

    #[rstest]
    #[case::heic(b"\0\0\0\x18ftypheic".to_vec())]
    #[case::text(b"just some words".to_vec())]
    #[case::html(b"<p>no picture here</p>".to_vec())]
    #[case::riff_that_is_not_webp(b"RIFF\0\0\0\0WAVE".to_vec())]
    #[case::empty(Vec::new())]
    fn does_not_recognize_anything_else(#[case] bytes: Vec<u8>) {
        assert!(!PastedImage::has_image_header(&bytes));
        assert_eq!(PastedImage::recognize(bytes), None);
    }

    #[rstest]
    #[case::png(b"\x89PNG\r\n\x1a\n rest of the picture".to_vec())]
    #[case::jpeg(b"\xff\xd8\xff\xe0 jfif".to_vec())]
    #[case::webp(webp(b"VP8X", 0b0000_0010))]
    #[case::gif(gif(2))]
    #[case::svg(format!("{}<svg/>", " ".repeat(100)).into_bytes())]
    fn the_header_alone_tells_a_recognised_image(#[case] bytes: Vec<u8>) {
        let header = &bytes[..bytes.len().min(PastedImage::HEADER_LENGTH)];

        assert!(PastedImage::has_image_header(header));
    }

    #[test]
    fn an_svg_tag_past_the_header_is_not_recognised_by_either_check() {
        let bytes =
            format!("<!--{}-->\n<svg/>", " ".repeat(PastedImage::HEADER_LENGTH)).into_bytes();
        let header = &bytes[..PastedImage::HEADER_LENGTH];

        assert!(!PastedImage::has_image_header(header));
        assert_eq!(PastedImage::recognize(bytes), None);
    }
}
