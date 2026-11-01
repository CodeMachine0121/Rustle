use rustle_domain::{
    ArticleDocument, ArticleDraft, ArticleDraftError, ArticleFileName, ArticleRepository,
    ArticleRepositoryError, ArticleWrite, Clock, LocalTimestamp, UneditableFrontMatter,
    WorkspaceName,
};
use serde::Serialize;
use thiserror::Error;

use crate::list_articles::ArticleSummary;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum UpdateArticleMetadataError {
    #[error(transparent)]
    Draft(#[from] ArticleDraftError),
    #[error(transparent)]
    FrontMatter(#[from] UneditableFrontMatter),
    #[error(transparent)]
    Article(#[from] ArticleRepositoryError),
}

/// A file another program changed between reading and writing it is an
/// expected answer: nothing was written, and trying again is safe.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "outcome", rename_all = "camelCase")]
pub enum MetadataUpdateOutcome {
    Updated { article: ArticleSummary },
    ModifiedElsewhere,
}

pub struct UpdateArticleMetadata<'a, Articles, UpdateClock> {
    articles: &'a Articles,
    clock: &'a UpdateClock,
}

impl<'a, Articles: ArticleRepository, UpdateClock: Clock>
    UpdateArticleMetadata<'a, Articles, UpdateClock>
{
    pub fn new(articles: &'a Articles, clock: &'a UpdateClock) -> Self {
        Self { articles, clock }
    }

    /// Writes the title, categories and tags and a fresh `updated_at`, and
    /// answers with the row read back from what was written. A blank title
    /// writes nothing, and neither does a file changed since it was read.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
        title: &str,
        category: &[String],
        tags: &[String],
    ) -> Result<MetadataUpdateOutcome, UpdateArticleMetadataError> {
        let draft = ArticleDraft::new(title, category, tags)?;
        let stored = self.articles.read(workspace, article)?;
        let now = self.clock.now();
        let updated_at = LocalTimestamp::new(now, self.clock.local_offset_seconds(now));
        let text = draft
            .edit(ArticleDocument::parse(&stored.text), updated_at)?
            .to_text();
        let outcome =
            match self
                .articles
                .write(workspace, article, &text, &stored.last_modified_at)?
            {
                ArticleWrite::Written { .. } => MetadataUpdateOutcome::Updated {
                    article: ArticleSummary::new(
                        article,
                        ArticleDocument::parse(&text).metadata(article),
                    ),
                },
                ArticleWrite::ModifiedElsewhere => MetadataUpdateOutcome::ModifiedElsewhere,
            };
        Ok(outcome)
    }
}
