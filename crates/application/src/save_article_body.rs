use rustle_domain::{
    ArticleDocument, ArticleFileName, ArticleRepository, ArticleRepositoryError, ArticleWrite,
    Clock, MetadataUpdate, UtcTimestamp, WorkspaceName,
};
use serde::Serialize;

/// Whether a save may replace a file that changed since the editor loaded it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutsideChanges {
    Refuse,
    Overwrite,
}

/// What the editor learns from one save. `last_known_modified_at` is what
/// the next save must expect; after an outside change it is the value the
/// editor sent, so the warning is not cleared by the reply itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(
    tag = "outcome",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum SavedBody {
    Saved {
        updated_at: String,
        last_known_modified_at: String,
    },
    ModifiedElsewhere {
        last_known_modified_at: String,
    },
}

pub struct SaveArticleBody<'a, Articles, SaveClock> {
    articles: &'a Articles,
    clock: &'a SaveClock,
}

impl<'a, Articles: ArticleRepository, SaveClock: Clock> SaveArticleBody<'a, Articles, SaveClock> {
    pub fn new(articles: &'a Articles, clock: &'a SaveClock) -> Self {
        Self { articles, clock }
    }

    /// Puts `body` and a fresh `updated_at` into the stored article and
    /// writes it, unless the file changed after `last_known_modified_at`
    /// and the user has not chosen to overwrite.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
        article: &ArticleFileName,
        body: &str,
        last_known_modified_at: &str,
        outside_changes: OutsideChanges,
    ) -> Result<SavedBody, ArticleRepositoryError> {
        let stored = self.articles.read(workspace, article)?;
        let expected_modified_at = match outside_changes {
            OutsideChanges::Refuse => last_known_modified_at,
            OutsideChanges::Overwrite => &stored.last_modified_at,
        };
        let updated_at = UtcTimestamp::from(self.clock.now()).to_string();
        let text = ArticleDocument::parse(&stored.text)
            .with_body(body)
            .with_metadata(&MetadataUpdate::default().updated_at(&updated_at))
            .to_text();
        let saved = match self
            .articles
            .write(workspace, article, &text, expected_modified_at)?
        {
            ArticleWrite::Written { modified_at } => SavedBody::Saved {
                updated_at,
                last_known_modified_at: modified_at,
            },
            ArticleWrite::ModifiedElsewhere => SavedBody::ModifiedElsewhere {
                last_known_modified_at: last_known_modified_at.to_owned(),
            },
        };
        Ok(saved)
    }
}
