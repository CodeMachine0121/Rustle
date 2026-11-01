use std::fs::{self, File};
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rstest::rstest;
use rustle_application::{
    ArticleSummary, MetadataUpdateOutcome, UpdateArticleMetadata, UpdateArticleMetadataError,
};
use rustle_domain::{
    ArticleDraftError, ArticleFileName, MockClock, UneditableFrontMatter, VaultScope, WorkspaceName,
};
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

const SAVED_AT_SECONDS: u64 = 1_787_236_325;
const TAIPEI_OFFSET_SECONDS: i32 = 8 * 3_600;
const SAVED_AT_IN_TAIPEI: &str = "2026-08-20T22:32:05+08:00";

const ANNOTATED_ARTICLE: &str = "---
# 這一行是使用者自己寫的註解
title: 舊標題
draft: true
created_at: 2026-08-20T14:32:05+08:00
updated_at: 2026-08-20T16:04:11+08:00
tags:
  - electron
---

正文第一行。
";

struct Vault {
    _directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn with_article(text: &str) -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        fs::write(root.join("Blog/tauri.md"), text).expect("article written");
        Self {
            _directory: directory,
            root,
        }
    }

    fn path(&self) -> PathBuf {
        self.root.join("Blog/tauri.md")
    }

    fn text(&self) -> String {
        fs::read_to_string(self.path()).expect("article readable")
    }

    fn clock() -> MockClock {
        let mut clock = MockClock::new();
        clock
            .expect_now()
            .return_const(UNIX_EPOCH + Duration::from_secs(SAVED_AT_SECONDS));
        clock
            .expect_local_offset_seconds()
            .return_const(TAIPEI_OFFSET_SECONDS);
        clock
    }

    fn update_with(
        &self,
        clock: &MockClock,
        title: &str,
        category: &[&str],
        tags: &[&str],
    ) -> Result<MetadataUpdateOutcome, UpdateArticleMetadataError> {
        let articles = FileSystemArticleRepository::in_vault(ResolvedVaultScope::new(
            VaultScope::new(&self.root),
        ));
        let owned = |values: &[&str]| {
            values
                .iter()
                .map(|value| (*value).to_owned())
                .collect::<Vec<_>>()
        };
        UpdateArticleMetadata::new(&articles, clock).execute(
            &WorkspaceName::parse("Blog").expect("valid workspace"),
            &ArticleFileName::parse("tauri.md").expect("valid article"),
            title,
            &owned(category),
            &owned(tags),
        )
    }

    fn update(
        &self,
        title: &str,
        category: &[&str],
        tags: &[&str],
    ) -> Result<MetadataUpdateOutcome, UpdateArticleMetadataError> {
        self.update_with(&Self::clock(), title, category, tags)
    }
}

#[test]
fn changes_only_title_category_and_updated_at_and_keeps_everything_else() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);

    vault
        .update("新標題", &["技術筆記"], &["electron"])
        .expect("updated");

    assert_eq!(
        vault.text(),
        format!(
            "---
# 這一行是使用者自己寫的註解
title: 新標題
draft: true
created_at: 2026-08-20T14:32:05+08:00
updated_at: {SAVED_AT_IN_TAIPEI}
tags:
  - electron
category:
  - 技術筆記
---

正文第一行。
"
        )
    );
}

#[test]
fn removes_the_category_key_when_every_category_is_removed() {
    let vault = Vault::with_article("---\ntitle: Zen\ncategory:\n  - 技術筆記\n---\n正文\n");

    vault.update("Zen", &[], &[]).expect("updated");

    assert!(!vault.text().contains("category"));
}

#[test]
fn trims_the_title_and_writes_a_repeated_category_once() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);

    vault
        .update(
            "　新標題　",
            &["技術筆記", "技術筆記", "桌面開發"],
            &["electron"],
        )
        .expect("updated");

    let text = vault.text();
    assert!(text.contains("\ntitle: 新標題\n"));
    assert!(text.contains("category:\n  - 技術筆記\n  - 桌面開發\n---"));
}

#[rstest]
#[case("")]
#[case("   ")]
#[case("　")]
fn refuses_a_blank_title_and_leaves_the_file_alone(#[case] title: &str) {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);

    let refused = vault.update(title, &["技術筆記"], &[]);

    assert_eq!(
        refused,
        Err(UpdateArticleMetadataError::Draft(
            ArticleDraftError::BlankTitle
        ))
    );
    assert_eq!(vault.text(), ANNOTATED_ARTICLE);
}

#[test]
fn writes_nothing_when_another_program_changes_the_file_after_it_was_read() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);
    let path = vault.path();
    let mut clock = MockClock::new();
    clock.expect_now().returning(move || {
        fs::write(&path, "另一個程式寫的內容").expect("outside change");
        File::options()
            .write(true)
            .open(&path)
            .and_then(|file| file.set_modified(SystemTime::now() + Duration::from_secs(60)))
            .expect("modification time moved");
        UNIX_EPOCH + Duration::from_secs(SAVED_AT_SECONDS)
    });
    clock
        .expect_local_offset_seconds()
        .return_const(TAIPEI_OFFSET_SECONDS);

    let outcome = vault.update_with(&clock, "新標題", &[], &[]);

    assert_eq!(outcome, Ok(MetadataUpdateOutcome::ModifiedElsewhere));
    assert_eq!(vault.text(), "另一個程式寫的內容");
}

#[test]
fn answers_with_the_row_read_back_from_what_was_written() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);

    let outcome = vault
        .update("新標題", &["技術筆記"], &["electron", "tauri"])
        .expect("updated");

    assert_eq!(
        outcome,
        MetadataUpdateOutcome::Updated {
            article: ArticleSummary {
                file_name: "tauri.md".to_owned(),
                title: "新標題".to_owned(),
                created_at: "2026-08-20T14:32:05+08:00".to_owned(),
                updated_at: SAVED_AT_IN_TAIPEI.to_owned(),
                category: vec!["技術筆記".to_owned()],
                tags: vec!["electron".to_owned(), "tauri".to_owned()],
                has_incomplete_metadata: false,
            }
        }
    );
}

#[test]
fn refuses_a_front_matter_it_cannot_edit_and_leaves_the_file_alone() {
    let broken = "---\ntitle: Zen\n  broken: indentation\n---\n正文\n";
    let vault = Vault::with_article(broken);

    let refused = vault.update("新標題", &[], &[]);

    assert_eq!(
        refused,
        Err(UpdateArticleMetadataError::FrontMatter(
            UneditableFrontMatter
        ))
    );
    assert_eq!(vault.text(), broken);
}

#[test]
fn a_missing_article_is_an_error() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);
    fs::remove_file(vault.path()).expect("removed");

    assert!(matches!(
        vault.update("新標題", &[], &[]),
        Err(UpdateArticleMetadataError::Article(_))
    ));
}

#[test]
fn sends_the_outcome_to_the_webview_in_camel_case() {
    let vault = Vault::with_article(ANNOTATED_ARTICLE);
    let updated = vault.update("新標題", &[], &[]).expect("updated");

    assert_eq!(
        serde_json::to_value(&updated).expect("serializable")["outcome"],
        json!("updated")
    );
    assert_eq!(
        serde_json::to_value(&updated).expect("serializable")["article"]["fileName"],
        json!("tauri.md")
    );
    assert_eq!(
        serde_json::to_value(MetadataUpdateOutcome::ModifiedElsewhere).expect("serializable"),
        json!({ "outcome": "modifiedElsewhere" })
    );
}
