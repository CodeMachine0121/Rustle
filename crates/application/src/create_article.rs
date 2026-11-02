use rustle_domain::{
    ArticleDocument, ArticleDraft, ArticleDraftError, ArticleRepository, ArticleRepositoryError,
    ArticleStatus, Clock, LocalTimestamp, WorkspaceName, WorkspaceRepository,
    WorkspaceRepositoryError,
};
use thiserror::Error;

use crate::list_articles::ArticleSummary;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum CreateArticleError {
    #[error(transparent)]
    Draft(#[from] ArticleDraftError),
    #[error(transparent)]
    Workspace(#[from] WorkspaceRepositoryError),
    #[error(transparent)]
    Article(#[from] ArticleRepositoryError),
}

pub struct CreateArticle<'a, Workspaces, Articles, CreationClock> {
    workspaces: &'a Workspaces,
    articles: &'a Articles,
    clock: &'a CreationClock,
}

impl<'a, Workspaces, Articles, CreationClock> CreateArticle<'a, Workspaces, Articles, CreationClock>
where
    Workspaces: WorkspaceRepository,
    Articles: ArticleRepository,
    CreationClock: Clock,
{
    pub fn new(
        workspaces: &'a Workspaces,
        articles: &'a Articles,
        clock: &'a CreationClock,
    ) -> Self {
        Self {
            workspaces,
            articles,
            clock,
        }
    }

    /// Writes a new article named after its title and answers with its row,
    /// read back from what was written. Nothing is written for a blank
    /// title, and an existing file is never replaced.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        title: &str,
        status: Option<ArticleStatus>,
        tags: &[String],
    ) -> Result<ArticleSummary, CreateArticleError> {
        let draft = ArticleDraft::new(title, status, tags)?;
        let file_name = draft.file_name(&self.workspaces.workspace_entries(workspace)?);
        let now = self.clock.now();
        let text = draft.to_text(LocalTimestamp::new(
            now,
            self.clock.local_offset_seconds(now),
        ));
        self.articles.create(workspace, &file_name, &text)?;
        Ok(ArticleSummary::from_document(
            workspace,
            &file_name,
            &ArticleDocument::parse(&text),
        ))
    }
}
