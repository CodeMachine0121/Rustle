//! Pure domain: names, rules and the traits infrastructure implements. No I/O.

mod vault_name;
mod vault_scope;

pub use vault_name::{ArticleFileName, ImageFileName, VaultPathError, WorkspaceName};
pub use vault_scope::{
    DEFAULT_VAULT_FOLDER_NAME, IMAGES_FOLDER_NAME, SETTINGS_FILE_NAME, SETTINGS_FOLDER_NAME,
    VaultScope,
};
