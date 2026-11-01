use std::fs::{self, File};
use std::io::{self, Read};
use std::path::Path;

use clipboard_rs::{Clipboard as _, ClipboardContext, ContentFormat};
use rustle_domain::{Clipboard, ClipboardError, PastedImage};

const PICTURE_FORMATS: [&str; 4] = ["public.png", "public.tiff", "PNG", "image/png"];

/// The operating system's clipboard. Copied files win over a picture,
/// because a copied file also puts its icon on the clipboard as a picture.
#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClipboard;

impl Clipboard for SystemClipboard {
    fn image_candidates(&self) -> Result<Vec<Vec<u8>>, ClipboardError> {
        let clipboard = ClipboardContext::new().map_err(ClipboardError::unreadable)?;
        let files = clipboard.get_files().unwrap_or_default();
        if !files.is_empty() {
            return files
                .iter()
                .filter_map(|file| CopiedFile::new(Path::new(file)).image_bytes().transpose())
                .map(|bytes| bytes.map_err(ClipboardError::unreadable))
                .collect();
        }
        Ok(PICTURE_FORMATS
            .iter()
            .find_map(|format| clipboard.get_buffer(format).ok())
            .filter(|picture| !picture.is_empty())
            .into_iter()
            .collect())
    }

    fn text(&self) -> Result<Option<String>, ClipboardError> {
        let clipboard = ClipboardContext::new().map_err(ClipboardError::unreadable)?;
        if !clipboard.has(ContentFormat::Text) {
            return Ok(None);
        }
        clipboard
            .get_text()
            .map(Some)
            .map_err(ClipboardError::unreadable)
    }

    fn set_text(&self, text: &str) -> Result<(), ClipboardError> {
        let clipboard = ClipboardContext::new().map_err(ClipboardError::unwritable)?;
        clipboard
            .set_text(text.to_owned())
            .map_err(ClipboardError::unwritable)
    }
}

/// A file the clipboard refers to. Only regular files whose header looks
/// like an image are read in full; folders and other files are skipped.
struct CopiedFile<'a> {
    path: &'a Path,
}

impl<'a> CopiedFile<'a> {
    fn new(path: &'a Path) -> Self {
        Self { path }
    }

    fn image_bytes(&self) -> io::Result<Option<Vec<u8>>> {
        if !fs::metadata(self.path)?.is_file() {
            return Ok(None);
        }
        let mut file = File::open(self.path)?;
        let mut bytes = Vec::new();
        Read::by_ref(&mut file)
            .take(PastedImage::HEADER_LENGTH as u64)
            .read_to_end(&mut bytes)?;
        if !PastedImage::has_image_header(&bytes) {
            return Ok(None);
        }
        file.read_to_end(&mut bytes)?;
        Ok(Some(bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PNG: &[u8] = b"\x89PNG\r\n\x1a\n";

    fn image_bytes(path: &Path) -> Option<Vec<u8>> {
        CopiedFile::new(path).image_bytes().expect("readable")
    }

    #[test]
    fn reads_a_copied_image_in_full() {
        let folder = tempfile::tempdir().expect("temporary folder");
        let path = folder.path().join("large.png");
        let picture = [PNG, &vec![7; PastedImage::HEADER_LENGTH * 3]].concat();
        fs::write(&path, &picture).expect("write");

        assert_eq!(image_bytes(&path), Some(picture));
    }

    #[test]
    fn skips_a_copied_file_that_is_not_an_image() {
        let folder = tempfile::tempdir().expect("temporary folder");
        let path = folder.path().join("notes.txt");
        fs::write(&path, "just some words").expect("write");

        assert_eq!(image_bytes(&path), None);
    }

    #[test]
    fn skips_a_copied_folder() {
        let folder = tempfile::tempdir().expect("temporary folder");
        let copied = folder.path().join("album.png");
        fs::create_dir(&copied).expect("folder");

        assert_eq!(image_bytes(&copied), None);
    }

    #[test]
    fn a_copied_file_that_has_vanished_is_unreadable() {
        let folder = tempfile::tempdir().expect("temporary folder");

        assert!(
            CopiedFile::new(&folder.path().join("gone.png"))
                .image_bytes()
                .is_err()
        );
    }
}
