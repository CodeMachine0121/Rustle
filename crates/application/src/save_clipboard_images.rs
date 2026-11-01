use rustle_domain::{
    Clipboard, ClipboardError, IdentifierGenerator, ImageAssetRepository,
    ImageAssetRepositoryError, ImageConversionError, ImageConverter, ImageFileName, ImageStorage,
    PNG_EXTENSION, PastedImage, VaultPathError, WorkspaceName,
};
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum SaveClipboardImagesError {
    #[error(transparent)]
    Clipboard(#[from] ClipboardError),
    #[error(transparent)]
    Conversion(#[from] ImageConversionError),
    #[error(transparent)]
    Name(#[from] VaultPathError),
    #[error(transparent)]
    Image(#[from] ImageAssetRepositoryError),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedClipboardImage {
    pub relative_path: String,
}

/// The images a paste stored, in clipboard order; empty when the clipboard
/// held no image.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedClipboardImages {
    pub images: Vec<SavedClipboardImage>,
}

pub struct SaveClipboardImages<'a, SystemClipboard, Images, Converter, Identifiers> {
    clipboard: &'a SystemClipboard,
    images: &'a Images,
    converter: &'a Converter,
    identifiers: &'a Identifiers,
}

impl<'a, SystemClipboard, Images, Converter, Identifiers>
    SaveClipboardImages<'a, SystemClipboard, Images, Converter, Identifiers>
where
    SystemClipboard: Clipboard,
    Images: ImageAssetRepository,
    Converter: ImageConverter,
    Identifiers: IdentifierGenerator,
{
    pub fn new(
        clipboard: &'a SystemClipboard,
        images: &'a Images,
        converter: &'a Converter,
        identifiers: &'a Identifiers,
    ) -> Self {
        Self {
            clipboard,
            images,
            converter,
            identifiers,
        }
    }

    /// Stores every image on the clipboard under a fresh name in the
    /// workspace's images folder. Every image is converted before the first
    /// file is created, and the first failure ends the paste.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<SavedClipboardImages, SaveClipboardImagesError> {
        let stored = self
            .clipboard
            .image_candidates()?
            .into_iter()
            .filter_map(PastedImage::recognize)
            .map(|image| self.prepare(&image))
            .collect::<Result<Vec<_>, _>>()?;
        let images = stored
            .iter()
            .map(|(name, bytes)| {
                self.images.create(workspace, name, bytes)?;
                Ok(SavedClipboardImage {
                    relative_path: name.relative_path(),
                })
            })
            .collect::<Result<_, SaveClipboardImagesError>>()?;
        Ok(SavedClipboardImages { images })
    }

    fn prepare(
        &self,
        image: &PastedImage,
    ) -> Result<(ImageFileName, Vec<u8>), SaveClipboardImagesError> {
        let (extension, bytes) = match image.storage() {
            ImageStorage::Original { extension } => (extension, image.bytes().to_vec()),
            ImageStorage::ConvertToPng => {
                (PNG_EXTENSION, self.converter.convert_to_png(image.bytes())?)
            }
        };
        let name = ImageFileName::parse(&format!("{}.{extension}", self.identifiers.generate()))?;
        Ok((name, bytes))
    }
}
