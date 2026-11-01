use rustle_domain::{
    ArticleDocument, ArticleFileName, ArticleRepository, ArticleRepositoryError, WorkspaceName,
};
use serde::Serialize;

/// What the editor gets for one article: the body without its front matter,
/// which article it is, and the modification time to detect outside edits.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleBody {
    pub workspace: String,
    pub file_name: String,
    pub body: String,
    pub last_known_modified_at: String,
}

pub struct ReadArticleBody<'a, Articles> {
    articles: &'a Articles,
}

impl<'a, Articles: ArticleRepository> ReadArticleBody<'a, Articles> {
    pub fn new(articles: &'a Articles) -> Self {
        Self { articles }
    }

    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<ArticleBody, ArticleRepositoryError> {
        let stored = self.articles.read(workspace, article)?;
        Ok(ArticleBody {
            workspace: workspace.to_string(),
            file_name: article.to_string(),
            body: ArticleDocument::parse(&stored.text).into_body(),
            last_known_modified_at: stored.last_modified_at,
        })
    }
}
