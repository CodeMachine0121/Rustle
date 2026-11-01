//! Pure domain: names, rules and the traits infrastructure implements. No I/O.

mod article_document;
mod article_draft;
mod article_file_name_slug;
mod article_metadata;
mod article_repository;
mod clipboard;
mod clock;
mod identifier_generator;
mod image_asset_repository;
mod image_converter;
mod local_timestamp;
mod metadata_update;
mod pasted_image;
mod settings;
mod trash;
mod utc_timestamp;
mod vault_entry;
mod vault_name;
mod vault_scope;
mod workspace_name_request;
mod workspace_repository;

pub use article_document::{ArticleDocument, UneditableFrontMatter};
pub use article_draft::{ArticleDraft, ArticleDraftError};
pub use article_file_name_slug::ArticleFileNameSlug;
pub use article_metadata::ArticleMetadata;
pub use article_repository::{
    ArticleRepository, ArticleRepositoryError, ArticleWrite, StoredArticle,
};
#[cfg(any(test, feature = "mocks"))]
pub use clipboard::MockClipboard;
pub use clipboard::{Clipboard, ClipboardError};
pub use clock::Clock;
#[cfg(any(test, feature = "mocks"))]
pub use clock::MockClock;
pub use identifier_generator::IdentifierGenerator;
#[cfg(any(test, feature = "mocks"))]
pub use identifier_generator::MockIdentifierGenerator;
pub use image_asset_repository::{ImageAssetRepository, ImageAssetRepositoryError};
#[cfg(any(test, feature = "mocks"))]
pub use image_converter::MockImageConverter;
pub use image_converter::{ImageConversionError, ImageConverter};
pub use local_timestamp::LocalTimestamp;
pub use metadata_update::MetadataUpdate;
pub use pasted_image::{ImageStorage, PNG_EXTENSION, PastedImage};
pub use settings::{
    IndentationSettings, IndentationStyle, LastOpenedSettings, PreviewPanelSettings, Settings,
    SettingsError, SettingsRepository,
};
#[cfg(any(test, feature = "mocks"))]
pub use trash::MockTrash;
pub use trash::{Trash, TrashError};
pub use utc_timestamp::UtcTimestamp;
pub use vault_entry::{VaultEntry, VaultEntryKind};
pub use vault_name::{ArticleFileName, ImageFileName, VaultPathError, WorkspaceName};
pub use vault_scope::{
    DEFAULT_VAULT_FOLDER_NAME, IMAGES_FOLDER_NAME, SETTINGS_FILE_NAME, SETTINGS_FOLDER_NAME,
    VaultScope,
};
pub use workspace_name_request::{WorkspaceNameRejection, WorkspaceNameRequest};
pub use workspace_repository::{WorkspaceRepository, WorkspaceRepositoryError};
