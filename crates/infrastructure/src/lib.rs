//! Implementations of the domain traits that touch the file system.

mod atomic_file;
mod file_system_article_repository;
mod file_system_settings_repository;
mod resolved_vault_scope;

pub use atomic_file::write_atomically;
pub use file_system_article_repository::FileSystemArticleRepository;
pub use file_system_settings_repository::FileSystemSettingsRepository;
pub use resolved_vault_scope::ResolvedVaultScope;
