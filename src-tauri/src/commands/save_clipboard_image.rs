use rustle_application::{SaveClipboardImages, SavedClipboardImages};
use rustle_domain::WorkspaceName;
use rustle_infrastructure::{
    FileSystemImageAssetRepository, RasterImageConverter, SystemClipboard, UuidGenerator,
};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn save_clipboard_image(
    images: State<'_, FileSystemImageAssetRepository>,
    workspace: String,
) -> Result<SavedClipboardImages, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(SaveClipboardImages::new(
        &SystemClipboard,
        images.inner(),
        &RasterImageConverter,
        &UuidGenerator,
    )
    .execute(&workspace)?)
}
