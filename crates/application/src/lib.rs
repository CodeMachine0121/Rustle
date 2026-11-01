//! Use cases, one struct each.

mod create_article;
mod create_workspace;
mod list_articles;
mod list_workspaces;
mod read_article_body;
mod read_settings;
mod save_article_body;
mod save_clipboard_images;
mod write_settings;

pub use create_article::{CreateArticle, CreateArticleError};
pub use create_workspace::{CreateWorkspace, CreateWorkspaceOutcome};
pub use list_articles::{ArticleSummary, ListArticles};
pub use list_workspaces::{ListWorkspaces, WorkspaceSummary};
pub use read_article_body::{ArticleBody, ReadArticleBody};
pub use read_settings::ReadSettings;
pub use save_article_body::{OutsideChanges, SaveArticleBody, SavedBody};
pub use save_clipboard_images::{
    SaveClipboardImages, SaveClipboardImagesError, SavedClipboardImage, SavedClipboardImages,
};
pub use write_settings::WriteSettings;
