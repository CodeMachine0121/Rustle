use rustle_application::{ArticleLocation, BodySearchResult, SearchArticleBodies};
use rustle_domain::{ArticleFileName, SearchText, WorkspaceName};
use rustle_infrastructure::FileSystemArticleRepository;
use serde::Deserialize;
use tauri::State;

use crate::command_error::CommandError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchedArticle {
    workspace: String,
    file_name: String,
}

#[tauri::command(async)]
pub fn search_bodies(
    repository: State<'_, FileSystemArticleRepository>,
    text: String,
    articles: Vec<SearchedArticle>,
) -> Result<BodySearchResult, CommandError> {
    let locations = articles
        .iter()
        .map(|article| {
            Ok(ArticleLocation {
                workspace: WorkspaceName::parse(&article.workspace)?,
                article: ArticleFileName::parse(&article.file_name)?,
            })
        })
        .collect::<Result<Vec<_>, CommandError>>()?;
    let Some(text) = SearchText::parse(&text) else {
        return Ok(BodySearchResult {
            matches: Vec::new(),
            is_truncated: false,
        });
    };
    Ok(SearchArticleBodies::new(repository.inner()).execute(&text, &locations))
}
