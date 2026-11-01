use rustle_application::{ArticleSummary, ListArticles};
use rustle_domain::WorkspaceName;
use rustle_infrastructure::{FileSystemArticleRepository, FileSystemWorkspaceRepository};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn list_articles(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    articles: State<'_, FileSystemArticleRepository>,
    workspace: String,
) -> Result<Vec<ArticleSummary>, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(ListArticles::new(workspaces.inner(), articles.inner()).execute(&workspace)?)
}
