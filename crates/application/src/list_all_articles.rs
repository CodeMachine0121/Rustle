use rustle_domain::{ArticleRepository, VaultEntry, WorkspaceRepository, WorkspaceRepositoryError};

use crate::list_articles::{ArticleSummary, ListArticles};

pub struct ListAllArticles<'a, Workspaces, Articles> {
    workspaces: &'a Workspaces,
    articles: &'a Articles,
}

impl<'a, Workspaces, Articles> ListAllArticles<'a, Workspaces, Articles>
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

    /// Every workspace's articles, workspace by workspace in name order. A
    /// workspace that cannot be read is left out instead of hiding the rest.
    pub fn execute(&self) -> Result<Vec<ArticleSummary>, WorkspaceRepositoryError> {
        let mut entries = self.workspaces.vault_entries()?;
        entries.sort_by(VaultEntry::compare_names);
        let list_articles = ListArticles::new(self.workspaces, self.articles);
        let mut articles = Vec::new();
        for workspace in entries.iter().filter_map(VaultEntry::as_workspace) {
            match list_articles.execute(&workspace) {
                Ok(workspace_articles) => articles.extend(workspace_articles),
                Err(WorkspaceRepositoryError::Unreadable { .. }) => {}
                Err(error) => return Err(error),
            }
        }
        Ok(articles)
    }
}
