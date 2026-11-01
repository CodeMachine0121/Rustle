use rustle_application::{ArticleBody, ReadArticleBody};
use rustle_domain::{ArticleFileName, WorkspaceName};
use rustle_infrastructure::FileSystemArticleRepository;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command]
pub fn read_body(
    articles: State<'_, FileSystemArticleRepository>,
    workspace: String,
    file_name: String,
) -> Result<ArticleBody, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    let article = ArticleFileName::parse(&file_name)?;
    Ok(ReadArticleBody::new(articles.inner()).execute(&workspace, &article)?)
}
