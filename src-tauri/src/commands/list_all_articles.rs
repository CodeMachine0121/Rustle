use rustle_application::{ArticleSummary, ListAllArticles};
use rustle_infrastructure::{FileSystemArticleRepository, FileSystemWorkspaceRepository};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn list_all_articles(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    articles: State<'_, FileSystemArticleRepository>,
) -> Result<Vec<ArticleSummary>, CommandError> {
    Ok(ListAllArticles::new(workspaces.inner(), articles.inner()).execute()?)
}
