use std::fs;

use rustle_application::{ArticleBody, ReadArticleBody};
use rustle_domain::{ArticleFileName, ArticleRepositoryError, VaultScope, WorkspaceName};
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

struct Vault {
    _directory: TempDir,
    articles: FileSystemArticleRepository,
}

impl Vault {
    fn with_article(file_name: &str, text: &str) -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        fs::write(root.join("Blog").join(file_name), text).expect("article written");
        Self {
            _directory: directory,
            articles: FileSystemArticleRepository::in_vault(ResolvedVaultScope::new(
                VaultScope::new(root),
            )),
        }
    }

    fn read_body(&self, file_name: &str) -> Result<ArticleBody, ArticleRepositoryError> {
        ReadArticleBody::new(&self.articles).execute(
            &WorkspaceName::parse("Blog").expect("valid workspace name"),
            &ArticleFileName::parse(file_name).expect("valid article name"),
        )
    }
}

#[test]
fn hands_over_the_body_and_names_the_article_it_was_asked_for() {
    let vault = Vault::with_article(
        "zen-of-writing.md",
        "---\ntitle: Zen of Writing\ntags:\n  - writing\n---\n\n正文的第一行。\n",
    );

    let article = vault.read_body("zen-of-writing.md").expect("readable");

    assert_eq!(article.body, "\n正文的第一行。\n");
    assert_eq!(article.workspace, "Blog");
    assert_eq!(article.file_name, "zen-of-writing.md");
    assert!(article.last_known_modified_at.ends_with('Z'));
}

#[test]
fn hands_over_a_file_without_front_matter_as_it_is() {
    let vault = Vault::with_article("plain.md", "# 只有正文\n\n第二段。\n");

    let article = vault.read_body("plain.md").expect("readable");

    assert_eq!(article.body, "# 只有正文\n\n第二段。\n");
}

#[test]
fn reports_a_missing_article_instead_of_an_empty_body() {
    let vault = Vault::with_article("plain.md", "正文");

    assert!(matches!(
        vault.read_body("missing.md"),
        Err(ArticleRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn sends_camel_case_fields_to_the_webview() {
    let article = ArticleBody {
        workspace: "Blog".to_owned(),
        file_name: "zen-of-writing.md".to_owned(),
        body: "正文".to_owned(),
        last_known_modified_at: "2026-08-20T08:04:11.123Z".to_owned(),
    };

    assert_eq!(
        serde_json::to_value(&article).expect("serializable"),
        json!({
            "workspace": "Blog",
            "fileName": "zen-of-writing.md",
            "body": "正文",
            "lastKnownModifiedAt": "2026-08-20T08:04:11.123Z",
        })
    );
}
