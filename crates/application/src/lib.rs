//! Use cases, one struct each.

mod create_workspace;
mod list_articles;
mod list_workspaces;
mod read_article_body;
mod read_settings;
mod write_settings;

pub use create_workspace::{CreateWorkspace, CreateWorkspaceOutcome};
pub use list_articles::{ArticleSummary, ListArticles};
pub use list_workspaces::{ListWorkspaces, WorkspaceSummary};
pub use read_article_body::{ArticleBody, ReadArticleBody};
pub use read_settings::ReadSettings;
pub use write_settings::WriteSettings;
