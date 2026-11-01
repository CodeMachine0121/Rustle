use rustle_application::{OutsideChanges, SaveArticleBody, SavedBody};
use rustle_domain::{ArticleFileName, WorkspaceName};
use rustle_infrastructure::{FileSystemArticleRepository, SystemClock};
use tauri::State;

use crate::command_error::CommandError;

#[tauri::command(async)]
pub fn save_body(
    articles: State<'_, FileSystemArticleRepository>,
    workspace: String,
    file_name: String,
    body: String,
    last_known_modified_at: String,
    overwrite: bool,
) -> Result<SavedBody, CommandError> {
    let workspace = WorkspaceName::parse(&workspace)?;
    let article = ArticleFileName::parse(&file_name)?;
    let outside_changes = if overwrite {
        OutsideChanges::Overwrite
    } else {
        OutsideChanges::Refuse
    };
    Ok(
        SaveArticleBody::new(articles.inner(), &SystemClock).execute(
            &workspace,
            &article,
            &body,
            &last_known_modified_at,
            outside_changes,
        )?,
    )
}
