use rustle_application::{MetadataUpdateOutcome, UpdateArticleMetadata};
use rustle_domain::{ArticleFileName, ArticleStatus, WorkspaceName};
use rustle_infrastructure::{FileSystemArticleRepository, SystemClock};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn update_metadata(
    articles: State<'_, FileSystemArticleRepository>,
    workspace: String,
    file_name: String,
    title: String,
    status: Option<ArticleStatus>,
    tags: Vec<String>,
) -> Result<MetadataUpdateOutcome, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    let article = ArticleFileName::parse(&file_name)?;
    Ok(UpdateArticleMetadata::new(articles.inner(), &SystemClock)
        .execute(&workspace, &article, &title, status, &tags)?)
}
