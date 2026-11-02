use rustle_domain::{
    ArticleDocument, ArticleExcerpt, ArticleFileName, ArticleMetadata, ArticleRepository,
    ArticleStatus, VaultEntry, WorkspaceName, WorkspaceRepository, WorkspaceRepositoryError,
};
use serde::Serialize;

/// One row of the article list: where the article lives and what it says
/// about itself.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArticleSummary {
    pub workspace: String,
    pub file_name: String,
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: Option<ArticleStatus>,
    pub tags: Vec<String>,
    pub has_incomplete_metadata: bool,
    pub excerpt: Option<String>,
}

impl ArticleSummary {
    pub(crate) fn from_document(
        workspace: &WorkspaceName,
        file_name: &ArticleFileName,
        document: &ArticleDocument,
    ) -> Self {
        Self::new(
            workspace,
            file_name,
            document.metadata(file_name),
            document.excerpt().map(ArticleExcerpt::into_string),
        )
    }

    /// The row of a file that could not be read: titled by its file name, with nothing to quote.
    pub(crate) fn unreadable(workspace: &WorkspaceName, file_name: &ArticleFileName) -> Self {
        Self::new(
            workspace,
            file_name,
            ArticleMetadata::from_file_name(file_name),
            None,
        )
    }

    fn new(
        workspace: &WorkspaceName,
        file_name: &ArticleFileName,
        metadata: ArticleMetadata,
        excerpt: Option<String>,
    ) -> Self {
        Self {
            workspace: workspace.to_string(),
            file_name: file_name.to_string(),
            title: metadata.title,
            created_at: metadata.created_at,
            updated_at: metadata.updated_at,
            status: metadata.status,
            tags: metadata.tags,
            has_incomplete_metadata: metadata.has_incomplete_metadata,
            excerpt,
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
            .map(
                |file_name| match self.articles.read(workspace, &file_name) {
                    Ok(stored) => ArticleSummary::from_document(
                        workspace,
                        &file_name,
                        &ArticleDocument::parse(&stored.text),
                    ),
                    Err(_) => ArticleSummary::unreadable(workspace, &file_name),
                },
            )
            .collect())
    }
}
