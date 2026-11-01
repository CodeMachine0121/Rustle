use std::fs;

use rustle_application::{ArticleLocation, BodyMatch, BodySearchResult, SearchArticleBodies};
use rustle_domain::{ArticleFileName, SearchText, VaultScope, WorkspaceName};
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

struct Vault {
    directory: TempDir,
    articles: FileSystemArticleRepository,
}

impl Vault {
    fn new() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(&root).expect("vault folder");
        let articles =
            FileSystemArticleRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(root)));
        Self {
            directory,
            articles,
        }
    }

    fn with_article(self, workspace: &str, file_name: &str, text: &str) -> Self {
        let folder = self.directory.path().join("Rustle").join(workspace);
        fs::create_dir_all(&folder).expect("workspace folder");
        fs::write(folder.join(file_name), text).expect("article written");
        self
    }

    fn search(&self, text: &str, articles: &[(&str, &str)]) -> BodySearchResult {
        let locations: Vec<ArticleLocation> = articles
            .iter()
            .map(|(workspace, file_name)| ArticleLocation {
                workspace: WorkspaceName::parse(workspace).expect("valid workspace name"),
                article: ArticleFileName::parse(file_name).expect("valid article name"),
            })
            .collect();
        SearchArticleBodies::new(&self.articles)
            .execute(&SearchText::parse(text).expect("not blank"), &locations)
    }
}

fn hit(workspace: &str, file_name: &str, line_number: usize, line_text: &str) -> BodyMatch {
    BodyMatch {
        workspace: workspace.to_owned(),
        file_name: file_name.to_owned(),
        line_number,
        line_text: line_text.to_owned(),
    }
}

fn many_lines(count: usize) -> String {
    vec!["我的字"; count].join("\n")
}

#[test]
fn names_the_article_the_body_line_and_its_text() {
    let vault = Vault::new().with_article(
        "日記",
        "tired.md",
        "---\ntitle: 今天很累\n---\n第一行\n第二行\n今天加班到很晚\n",
    );

    let result = vault.search("加班", &[("日記", "tired.md")]);

    assert_eq!(
        result,
        BodySearchResult {
            matches: vec![hit("日記", "tired.md", 3, "今天加班到很晚")],
            is_truncated: false,
        }
    );
}

#[test]
fn never_looks_in_the_front_matter() {
    let vault = Vault::new().with_article(
        "日記",
        "overtime.md",
        "---\ntitle: 加班\ntags:\n  - 加班\n---\n今天很累\n",
    );

    let result = vault.search("加班", &[("日記", "overtime.md")]);

    assert!(result.matches.is_empty());
}

#[test]
fn searches_only_the_given_articles_in_the_given_order() {
    let vault = Vault::new()
        .with_article("日記", "older.md", "加班\n")
        .with_article("日記", "newer.md", "又加班\n")
        .with_article("工作", "meeting.md", "加班會議\n");

    let result = vault.search("加班", &[("日記", "newer.md"), ("日記", "older.md")]);

    assert_eq!(
        result.matches,
        vec![
            hit("日記", "newer.md", 1, "又加班"),
            hit("日記", "older.md", 1, "加班"),
        ]
    );
}

#[test]
fn skips_an_article_that_cannot_be_read_and_lists_the_rest() {
    let vault = Vault::new().with_article("日記", "kept.md", "加班\n");

    let result = vault.search("加班", &[("日記", "gone.md"), ("日記", "kept.md")]);

    assert_eq!(result.matches, vec![hit("日記", "kept.md", 1, "加班")]);
}

#[test]
fn lists_the_first_two_hundred_and_says_there_were_more() {
    let vault = Vault::new()
        .with_article("日記", "first.md", &many_lines(300))
        .with_article("日記", "second.md", &many_lines(200));

    let result = vault.search("的", &[("日記", "first.md"), ("日記", "second.md")]);

    assert_eq!(result.matches.len(), 200);
    assert!(result.is_truncated);
    assert!(result.matches.iter().all(|hit| hit.file_name == "first.md"));
}

#[test]
fn exactly_two_hundred_hits_are_not_too_many() {
    let vault = Vault::new().with_article("日記", "full.md", &many_lines(200));

    let result = vault.search("的", &[("日記", "full.md")]);

    assert_eq!(result.matches.len(), 200);
    assert!(!result.is_truncated);
}

#[test]
fn sends_camel_case_fields_to_the_webview() {
    let result = BodySearchResult {
        matches: vec![hit("日記", "tired.md", 3, "今天加班到很晚")],
        is_truncated: false,
    };

    assert_eq!(
        serde_json::to_value(&result).expect("serializable"),
        json!({
            "matches": [{
                "workspace": "日記",
                "fileName": "tired.md",
                "lineNumber": 3,
                "lineText": "今天加班到很晚"
            }],
            "isTruncated": false
        })
    );
}
