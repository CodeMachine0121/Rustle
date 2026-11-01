//! Use cases, one struct each.

mod count_workspace_contents;
mod create_article;
mod create_workspace;
mod delete_article;
mod delete_workspace;
mod list_all_articles;
mod list_articles;
mod list_workspaces;
mod read_article_body;
mod read_settings;
mod rename_workspace;
mod save_article_body;
mod save_clipboard_images;
mod update_article_metadata;
mod write_settings;

pub use count_workspace_contents::{CountWorkspaceContents, WorkspaceContents};
pub use create_article::{CreateArticle, CreateArticleError};
pub use create_workspace::{CreateWorkspace, CreateWorkspaceOutcome};
pub use delete_article::{DeleteArticle, DeleteArticleError};
pub use delete_workspace::{DeleteWorkspace, DeleteWorkspaceError};
pub use list_all_articles::ListAllArticles;
pub use list_articles::{ArticleSummary, ListArticles};
pub use list_workspaces::{ListWorkspaces, WorkspaceSummary};
pub use read_article_body::{ArticleBody, ReadArticleBody};
pub use read_settings::ReadSettings;
pub use rename_workspace::{RenameWorkspace, RenameWorkspaceOutcome};
pub use save_article_body::{OutsideChanges, SaveArticleBody, SavedBody};
pub use save_clipboard_images::{
    SaveClipboardImages, SaveClipboardImagesError, SavedClipboardImage, SavedClipboardImages,
};
pub use update_article_metadata::{
    MetadataUpdateOutcome, UpdateArticleMetadata, UpdateArticleMetadataError,
};
pub use write_settings::WriteSettings;
