//! Implementations of the domain traits that touch the file system, the clipboard
//! and other machine resources.

mod atomic_file;
mod file_system_article_repository;
mod file_system_image_asset_repository;
mod file_system_settings_repository;
mod file_system_workspace_repository;
mod raster_image_converter;
mod resolved_vault_scope;
mod system_clipboard;
mod system_clock;
mod system_language_preferences;
mod system_trash;
mod uuid_generator;

pub use atomic_file::write_atomically;
pub use file_system_article_repository::FileSystemArticleRepository;
pub use file_system_image_asset_repository::FileSystemImageAssetRepository;
pub use file_system_settings_repository::FileSystemSettingsRepository;
pub use file_system_workspace_repository::FileSystemWorkspaceRepository;
pub use raster_image_converter::RasterImageConverter;
pub use resolved_vault_scope::ResolvedVaultScope;
pub use system_clipboard::SystemClipboard;
pub use system_clock::SystemClock;
pub use system_language_preferences::SystemLanguagePreferences;
pub use system_trash::SystemTrash;
pub use uuid_generator::UuidGenerator;
