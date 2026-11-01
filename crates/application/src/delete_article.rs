use rustle_domain::{ArticleFileName, Trash, TrashError, WorkspaceName};
use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum DeleteArticleError {
    #[error("'{file_name}' is not an article")]
    NotAnArticle { file_name: String },
    #[error(transparent)]
    Trash(#[from] TrashError),
}

pub struct DeleteArticle<'a, SystemTrash> {
    trash: &'a SystemTrash,
}

impl<'a, SystemTrash: Trash> DeleteArticle<'a, SystemTrash> {
    pub fn new(trash: &'a SystemTrash) -> Self {
        Self { trash }
    }

    /// Moves the article file alone to the trash: the workspace's images
    /// are shared by its articles and are never touched.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
    ) -> Result<(), DeleteArticleError> {
        if article.markdown_stem().is_none() {
            return Err(DeleteArticleError::NotAnArticle {
                file_name: article.to_string(),
            });
        }
        Ok(self.trash.move_article_to_trash(workspace, article)?)
    }
}
