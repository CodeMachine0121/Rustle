//! Pure domain: names, rules and the traits infrastructure implements. No I/O.

mod article_document;
mod article_file_name_slug;
mod article_metadata;
mod article_repository;
mod metadata_update;
mod settings;
mod utc_timestamp;
mod vault_name;
mod vault_scope;

pub use article_document::ArticleDocument;
pub use article_file_name_slug::ArticleFileNameSlug;
pub use article_metadata::ArticleMetadata;
pub use article_repository::{
    ArticleRepository, ArticleRepositoryError, ArticleWrite, StoredArticle,
};
pub use metadata_update::MetadataUpdate;
pub use settings::{Settings, SettingsError, SettingsRepository};
pub use utc_timestamp::UtcTimestamp;
pub use vault_name::{ArticleFileName, ImageFileName, VaultPathError, WorkspaceName};
pub use vault_scope::{
    DEFAULT_VAULT_FOLDER_NAME, IMAGES_FOLDER_NAME, SETTINGS_FILE_NAME, SETTINGS_FOLDER_NAME,
    VaultScope,
};
