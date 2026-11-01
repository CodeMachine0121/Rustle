//! Pure domain: names, rules and the traits infrastructure implements. No I/O.

mod article_document;
mod article_file_name_slug;
mod article_metadata;
mod article_repository;
mod clock;
mod metadata_update;
mod settings;
mod utc_timestamp;
mod vault_entry;
mod vault_name;
mod vault_scope;
mod workspace_name_request;
mod workspace_repository;

pub use article_document::ArticleDocument;
pub use article_file_name_slug::ArticleFileNameSlug;
pub use article_metadata::ArticleMetadata;
pub use article_repository::{
    ArticleRepository, ArticleRepositoryError, ArticleWrite, StoredArticle,
};
pub use clock::Clock;
#[cfg(any(test, feature = "mocks"))]
pub use clock::MockClock;
pub use metadata_update::MetadataUpdate;
pub use settings::{
    IndentationSettings, IndentationStyle, LastOpenedSettings, PreviewPanelSettings, Settings,
    SettingsError, SettingsRepository,
};
pub use utc_timestamp::UtcTimestamp;
pub use vault_entry::{VaultEntry, VaultEntryKind};
pub use vault_name::{ArticleFileName, ImageFileName, VaultPathError, WorkspaceName};
pub use vault_scope::{
    DEFAULT_VAULT_FOLDER_NAME, IMAGES_FOLDER_NAME, SETTINGS_FILE_NAME, SETTINGS_FOLDER_NAME,
    VaultScope,
};
pub use workspace_name_request::{WorkspaceNameRejection, WorkspaceNameRequest};
pub use workspace_repository::{WorkspaceRepository, WorkspaceRepositoryError};
