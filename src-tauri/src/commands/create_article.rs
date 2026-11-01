use rustle_application::{ArticleSummary, CreateArticle};
use rustle_domain::{ArticleStatus, WorkspaceName};
use rustle_infrastructure::{
    FileSystemArticleRepository, FileSystemWorkspaceRepository, SystemClock,
};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn create_article(
    workspaces: State<'_, FileSystemWorkspaceRepository>,
    articles: State<'_, FileSystemArticleRepository>,
    workspace: String,
    title: String,
    status: Option<ArticleStatus>,
    tags: Vec<String>,
) -> Result<ArticleSummary, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    Ok(
        CreateArticle::new(workspaces.inner(), articles.inner(), &SystemClock)
            .execute(&workspace, &title, status, &tags)?,
    )
}
