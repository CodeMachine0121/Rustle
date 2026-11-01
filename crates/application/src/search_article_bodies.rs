use rustle_domain::{
    ArticleDocument, ArticleFileName, ArticleRepository, BODY_MATCH_LIMIT, SearchText,
    WorkspaceName,
};
use serde::Serialize;

/// Which article to search, wherever it is listed.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleLocation {
    pub workspace: WorkspaceName,
    pub article: ArticleFileName,
}

/// One body line that holds the search text.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BodyMatch {
    pub workspace: String,
    pub file_name: String,
    pub line_number: usize,
    pub line_text: String,
}

/// The first hits, and whether there were more than could be listed.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BodySearchResult {
    pub matches: Vec<BodyMatch>,
    pub is_truncated: bool,
}

pub struct SearchArticleBodies<'a, Articles> {
    articles: &'a Articles,
}

impl<'a, Articles: ArticleRepository> SearchArticleBodies<'a, Articles> {
    pub fn new(articles: &'a Articles) -> Self {
        Self { articles }
    }

    /// Searches the bodies as saved in the files, article by article in the
    /// given order and line by line within one. An article that cannot be
    /// read is skipped; the search stops once more hits than can be listed
    /// are found.
    pub fn execute(&self, text: &SearchText, locations: &[ArticleLocation]) -> BodySearchResult {
        let mut hits = locations
            .iter()
            .filter_map(|location| {
                let stored = self
                    .articles
                    .read(&location.workspace, &location.article)
                    .ok()?;
                Some((location, ArticleDocument::parse(&stored.text).into_body()))
            })
            .flat_map(|(location, body)| {
                text.matching_lines(&body)
                    .map(|line| BodyMatch {
                        workspace: location.workspace.to_string(),
                        file_name: location.article.to_string(),
                        line_number: line.number,
                        line_text: line.text,
                    })
                    .collect::<Vec<_>>()
            });
        let matches: Vec<BodyMatch> = hits.by_ref().take(BODY_MATCH_LIMIT).collect();
        let is_truncated = hits.next().is_some();
        BodySearchResult {
            matches,
            is_truncated,
        }
    }
}
