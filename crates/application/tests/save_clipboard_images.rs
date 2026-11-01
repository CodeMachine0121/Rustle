use std::fs;
use std::path::PathBuf;

use rustle_application::{SaveClipboardImages, SaveClipboardImagesError, SavedClipboardImage};
use rustle_domain::{
    ClipboardError, ImageAssetRepositoryError, ImageConversionError, MockClipboard,
    MockIdentifierGenerator, MockImageConverter, VaultScope, WorkspaceName,
};
use rustle_infrastructure::{FileSystemImageAssetRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

const PNG: &[u8] = b"\x89PNG\r\n\x1a\nscreenshot pixels";
const JPEG: &[u8] = b"\xff\xd8\xff\xe0photo";
const SVG: &[u8] = b"<svg xmlns=\"http://www.w3.org/2000/svg\"/>";
const HEIC: &[u8] = b"\0\0\0\x18ftypheic";
const CONVERTED: &[u8] = b"\x89PNG\r\n\x1a\nconverted";

struct Vault {
    _directory: TempDir,
    root: PathBuf,
    images: FileSystemImageAssetRepository,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        let images = FileSystemImageAssetRepository::in_vault(ResolvedVaultScope::new(
            VaultScope::new(&root),
        ));
        Self {
            _directory: directory,
            root,
            images,
        }
    }

    fn images_folder(&self) -> PathBuf {
        self.root.join("Blog/images")
    }

    fn image_names(&self) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(self.images_folder())
            .map(|entries| {
                entries
                    .map(|entry| {
                        entry
                            .expect("entry")
                            .file_name()
                            .to_string_lossy()
                            .into_owned()
                    })
                    .collect()
            })
            .unwrap_or_default();
        names.sort();
        names
    }

    fn image(&self, name: &str) -> Vec<u8> {
        fs::read(self.images_folder().join(name)).expect("image on disk")
    }
}

fn clipboard_with(candidates: &[&[u8]]) -> MockClipboard {
    let candidates: Vec<Vec<u8>> = candidates.iter().map(|bytes| bytes.to_vec()).collect();
    let mut clipboard = MockClipboard::new();
    clipboard
        .expect_image_candidates()
        .returning(move || Ok(candidates.clone()));
    clipboard
}

fn identifiers(names: &'static [&'static str]) -> MockIdentifierGenerator {
    let mut identifiers = MockIdentifierGenerator::new();
    let mut next = names.iter();
    identifiers
        .expect_generate()
        .returning(move || next.next().expect("enough identifiers").to_string());
    identifiers
}

fn never_converting() -> MockImageConverter {
    let mut converter = MockImageConverter::new();
    converter.expect_convert_to_png().never();
    converter
}

fn converting() -> MockImageConverter {
    let mut converter = MockImageConverter::new();
    converter
        .expect_convert_to_png()
        .returning(|_| Ok(CONVERTED.to_vec()));
    converter
}

fn blog() -> WorkspaceName {
    WorkspaceName::parse("Blog").expect("valid workspace")
}

fn saved(paths: &[&str]) -> Vec<SavedClipboardImage> {
    paths
        .iter()
        .map(|path| SavedClipboardImage {
            relative_path: (*path).to_owned(),
        })
        .collect()
}

#[test]
fn stores_a_screenshot_as_it_is_without_asking_the_image_library() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["8f3c1e42-9b2a-4d71-a6e5-0c3f8d1b7e94"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(
        result.images,
        saved(&["images/8f3c1e42-9b2a-4d71-a6e5-0c3f8d1b7e94.png"])
    );
    assert_eq!(vault.image("8f3c1e42-9b2a-4d71-a6e5-0c3f8d1b7e94.png"), PNG);
}

#[test]
fn creates_the_images_folder_when_it_is_missing() {
    let vault = Vault::create();
    assert!(!vault.images_folder().exists());

    SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["first"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(vault.image_names(), ["first.png"]);
}

#[test]
fn keeps_what_the_images_folder_already_holds() {
    let vault = Vault::create();
    fs::create_dir(vault.images_folder()).expect("images folder");
    fs::write(vault.images_folder().join("older.png"), "older").expect("older image");

    SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["newer"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(vault.image_names(), ["newer.png", "older.png"]);
    assert_eq!(vault.image("older.png"), b"older");
}

#[test]
fn stores_a_still_raster_image_as_the_converted_png() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[JPEG]),
        &vault.images,
        &converting(),
        &identifiers(&["photo"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(result.images, saved(&["images/photo.png"]));
    assert_eq!(vault.image("photo.png"), CONVERTED);
}

#[test]
fn keeps_an_svg_without_asking_the_image_library() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[SVG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["diagram"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(result.images, saved(&["images/diagram.svg"]));
    assert_eq!(vault.image("diagram.svg"), SVG);
}

#[test]
fn keeps_an_animated_gif_and_an_animated_webp_byte_for_byte() {
    let vault = Vault::create();
    let frame: &[u8] = &[0x2c, 0, 0, 0, 0, 1, 0, 1, 0, 0x00, 2, 2, 0x4c, 0x01, 0];
    let animated_gif = [b"GIF89a\x01\0\x01\0\0\0\0".as_slice(), frame, frame, b";"].concat();
    let animated_webp = b"RIFF\0\0\0\0WEBPVP8X\x0a\0\0\0\x02\0\0\0ANIM".to_vec();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[&animated_gif, &animated_webp]),
        &vault.images,
        &never_converting(),
        &identifiers(&["loop", "motion"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(
        result.images,
        saved(&["images/loop.gif", "images/motion.webp"])
    );
    assert_eq!(vault.image("loop.gif"), animated_gif);
    assert_eq!(vault.image("motion.webp"), animated_webp);
}

#[test]
fn stores_several_images_in_clipboard_order() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[SVG, PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["b-first", "a-second"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(
        result.images,
        saved(&["images/b-first.svg", "images/a-second.png"])
    );
    assert_eq!(vault.image_names(), ["a-second.png", "b-first.svg"]);
}

#[test]
fn answers_with_no_images_and_stores_nothing_when_nothing_is_an_image() {
    let vault = Vault::create();
    let mut identifiers = MockIdentifierGenerator::new();
    identifiers.expect_generate().never();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[HEIC, b"plain words"]),
        &vault.images,
        &never_converting(),
        &identifiers,
    )
    .execute(&blog())
    .expect("nothing to save is not a failure");

    assert_eq!(
        serde_json::to_value(result).expect("serializable"),
        json!({ "images": [] })
    );
    assert!(!vault.images_folder().exists());
}

#[test]
fn an_empty_clipboard_stores_nothing() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[]),
        &vault.images,
        &never_converting(),
        &identifiers(&[]),
    )
    .execute(&blog())
    .expect("nothing to save is not a failure");

    assert!(result.images.is_empty());
}

#[test]
fn answers_with_relative_paths_in_camel_case() {
    let vault = Vault::create();

    let result = SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["8f3c"]),
    )
    .execute(&blog())
    .expect("saved");

    assert_eq!(
        serde_json::to_value(result).expect("serializable"),
        json!({ "images": [{ "relativePath": "images/8f3c.png" }] })
    );
}

#[test]
fn an_unreadable_clipboard_fails_the_paste() {
    let vault = Vault::create();
    let mut clipboard = MockClipboard::new();
    clipboard
        .expect_image_candidates()
        .returning(|| Err(ClipboardError::Unreadable("no pasteboard".to_owned())));

    let error = SaveClipboardImages::new(
        &clipboard,
        &vault.images,
        &never_converting(),
        &identifiers(&[]),
    )
    .execute(&blog())
    .expect_err("fails");

    assert!(matches!(error, SaveClipboardImagesError::Clipboard(_)));
}

#[test]
fn an_image_that_cannot_be_converted_fails_the_paste_before_anything_is_stored() {
    let vault = Vault::create();
    let mut converter = MockImageConverter::new();
    converter
        .expect_convert_to_png()
        .returning(|_| Err(ImageConversionError::Unconvertible("broken".to_owned())));

    let error = SaveClipboardImages::new(
        &clipboard_with(&[PNG, JPEG]),
        &vault.images,
        &converter,
        &identifiers(&["first"]),
    )
    .execute(&blog())
    .expect_err("fails");

    assert!(matches!(error, SaveClipboardImagesError::Conversion(_)));
    assert!(vault.image_names().is_empty());
}

#[test]
fn a_name_that_is_not_a_plain_file_name_fails_the_paste() {
    let vault = Vault::create();

    let error = SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["../escape"]),
    )
    .execute(&blog())
    .expect_err("fails");

    assert!(matches!(error, SaveClipboardImagesError::Name(_)));
    assert!(!vault.root.join("Blog/escape.png").exists());
}

#[test]
fn a_file_that_cannot_be_written_fails_the_paste() {
    let vault = Vault::create();
    fs::create_dir(vault.images_folder()).expect("images folder");
    fs::write(vault.images_folder().join("taken.png"), "older").expect("older image");

    let error = SaveClipboardImages::new(
        &clipboard_with(&[PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["taken"]),
    )
    .execute(&blog())
    .expect_err("fails");

    assert_eq!(
        error,
        SaveClipboardImagesError::Image(ImageAssetRepositoryError::AlreadyExists {
            image: "Blog/images/taken.png".to_owned()
        })
    );
    assert_eq!(vault.image("taken.png"), b"older");
}

#[test]
fn a_second_image_that_cannot_be_written_fails_the_whole_paste() {
    let vault = Vault::create();
    fs::create_dir(vault.images_folder()).expect("images folder");
    fs::write(vault.images_folder().join("taken.png"), "older").expect("older image");

    let result = SaveClipboardImages::new(
        &clipboard_with(&[PNG, PNG]),
        &vault.images,
        &never_converting(),
        &identifiers(&["free", "taken"]),
    )
    .execute(&blog());

    assert!(matches!(result, Err(SaveClipboardImagesError::Image(_))));
}
