use rustle_domain::{
    ArticleDocument, ArticleFileName, ArticleMetadata, ArticleRepository, VaultEntry,
    WorkspaceName, WorkspaceRepository, WorkspaceRepositoryError,
};
use serde::Serialize;

/// One row of the article list: what the article says about itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSummary {
    pub file_name: String,
    pub title: String,
    pub created_at: String,
    pub category: Vec<String>,
    pub tags: Vec<String>,
    pub has_incomplete_metadata: bool,
}

impl ArticleSummary {
    fn new(file_name: &ArticleFileName, metadata: ArticleMetadata) -> Self {
        Self {
            file_name: file_name.to_string(),
            title: metadata.title,
            created_at: metadata.created_at,
            category: metadata.category,
            tags: metadata.tags,
            has_incomplete_metadata: metadata.has_incomplete_metadata,
        }
    }
}

pub struct ListArticles<'a, Workspaces, Articles> {
    workspaces: &'a Workspaces,
    articles: &'a Articles,
}

impl<'a, Workspaces, Articles> ListArticles<'a, Workspaces, Articles>
where
    Workspaces: WorkspaceRepository,
    Articles: ArticleRepository,
{
    pub fn new(workspaces: &'a Workspaces, articles: &'a Articles) -> Self {
        Self {
            workspaces,
            articles,
        }
    }

    /// The articles of one workspace in file name order. A file that cannot
    /// be read is still listed, titled by its file name and marked as having
    /// incomplete metadata.
    pub fn execute(
        &self,
        workspace: &WorkspaceName,
    ) -> Result<Vec<ArticleSummary>, WorkspaceRepositoryError> {
        let mut entries = self.workspaces.workspace_entries(workspace)?;
        entries.sort_by(VaultEntry::compare_names);
        Ok(entries
            .iter()
            .filter_map(VaultEntry::as_article)
            .map(|file_name| {
                let metadata = match self.articles.read(workspace, &file_name) {
                    Ok(stored) => ArticleDocument::parse(&stored.text).metadata(&file_name),
                    Err(_) => ArticleMetadata::from_file_name(&file_name),
                };
                ArticleSummary::new(&file_name, metadata)
            })
            .collect())
    }
}
