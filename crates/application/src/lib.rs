//! Use cases, one struct each.

mod create_article;
mod create_workspace;
mod delete_article;
mod list_articles;
mod list_workspaces;
mod read_article_body;
mod read_settings;
mod save_article_body;
mod update_article_metadata;
mod write_settings;

pub use create_article::{CreateArticle, CreateArticleError};
pub use create_workspace::{CreateWorkspace, CreateWorkspaceOutcome};
pub use delete_article::{DeleteArticle, DeleteArticleError};
pub use list_articles::{ArticleSummary, ListArticles};
pub use list_workspaces::{ListWorkspaces, WorkspaceSummary};
pub use read_article_body::{ArticleBody, ReadArticleBody};
pub use read_settings::ReadSettings;
pub use save_article_body::{OutsideChanges, SaveArticleBody, SavedBody};
pub use update_article_metadata::{
    MetadataUpdateOutcome, UpdateArticleMetadata, UpdateArticleMetadataError,
};
pub use write_settings::WriteSettings;
