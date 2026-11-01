use rustle_application::DeleteArticle;
use rustle_domain::{ArticleFileName, WorkspaceName};
use rustle_infrastructure::SystemTrash;
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn delete_article(
    trash: State<'_, SystemTrash>,
    workspace: String,
    file_name: String,
) -> Result<(), CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    let article = ArticleFileName::parse(&file_name)?;
    Ok(DeleteArticle::new(trash.inner()).execute(&workspace, &article)?)
}
