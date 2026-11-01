use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, UNIX_EPOCH};

use rustle_application::{ArticleSummary, CreateArticle, CreateArticleError, ListArticles};
use rustle_domain::{
    ArticleDraftError, ArticleRepositoryError, MockClock, VaultScope, WorkspaceName,
    WorkspaceRepositoryError,
};
use rustle_infrastructure::{
    FileSystemArticleRepository, FileSystemWorkspaceRepository, ResolvedVaultScope,
};
use serde_json::json;
use tempfile::TempDir;

const CREATED_AT_SECONDS: u64 = 1_787_236_325;
const TAIPEI_OFFSET_SECONDS: i32 = 8 * 3_600;

struct Vault {
    directory: TempDir,
    root: PathBuf,
    clock: MockClock,
}

impl Vault {
    fn create() -> Self {
        Self::at(CREATED_AT_SECONDS, 0)
    }

    fn at(utc_seconds: u64, offset_seconds: i32) -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        let mut clock = MockClock::new();
        clock
            .expect_now()
            .return_const(UNIX_EPOCH + Duration::from_secs(utc_seconds));
        clock
            .expect_local_offset_seconds()
            .return_const(offset_seconds);
        Self {
            directory,
            root,
            clock,
        }
    }

    fn file(&self, relative_path: &str, text: &str) -> &Self {
        fs::write(self.root.join(relative_path), text).expect("file written");
        self
    }

    fn scope_at(root: &Path) -> ResolvedVaultScope {
        ResolvedVaultScope::new(VaultScope::new(root))
    }

    fn create_article_at(
        &self,
        root: &Path,
        workspace: &str,
        title: &str,
        category: &[&str],
        tags: &[&str],
    ) -> Result<ArticleSummary, CreateArticleError> {
        let workspaces = FileSystemWorkspaceRepository::in_vault(Self::scope_at(root));
        let articles = FileSystemArticleRepository::in_vault(Self::scope_at(root));
        let owned = |values: &[&str]| {
            values
                .iter()
                .map(|value| (*value).to_owned())
                .collect::<Vec<_>>()
        };
        CreateArticle::new(&workspaces, &articles, &self.clock).execute(
            &WorkspaceName::parse(workspace).expect("valid workspace name"),
            title,
            &owned(category),
            &owned(tags),
        )
    }

    fn create_article(
        &self,
        title: &str,
        category: &[&str],
        tags: &[&str],
    ) -> Result<ArticleSummary, CreateArticleError> {
        self.create_article_at(&self.root, "Blog", title, category, tags)
    }

    fn text_of(&self, relative_path: &str) -> String {
        fs::read_to_string(self.root.join(relative_path)).expect("readable file")
    }

    fn names_in(folder: &Path) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(folder)
            .expect("listable folder")
            .map(|entry| {
                entry
                    .expect("entry")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        names.sort_unstable();
        names
    }
}

#[test]
fn writes_a_front_matter_named_after_the_title_and_no_body() {
    let vault = Vault::create();

    vault
        .create_article(
            "Tauri 與 Electron 的取捨",
            &["技術筆記", "桌面開發"],
            &["tauri", "electron"],
        )
        .expect("created");

    assert_eq!(
        vault.text_of("Blog/tauri-與-electron-的取捨.md"),
        "---\n\
         title: Tauri 與 Electron 的取捨\n\
         created_at: 2026-08-20T14:32:05+00:00\n\
         updated_at: 2026-08-20T14:32:05+00:00\n\
         category:\n  - 技術筆記\n  - 桌面開發\n\
         tags:\n  - tauri\n  - electron\n\
         ---\n"
    );
}

#[test]
fn writes_the_creation_time_in_the_writers_own_time_zone() {
    let half_past_midnight_in_taipei = 1_787_157_000;
    let vault = Vault::at(half_past_midnight_in_taipei, TAIPEI_OFFSET_SECONDS);

    let summary = vault
        .create_article("Zen of Writing", &[], &[])
        .expect("created");

    let text = vault.text_of("Blog/zen-of-writing.md");
    assert!(
        text.contains("created_at: 2026-08-20T00:30:00+08:00\n"),
        "{text}"
    );
    assert!(
        text.contains("updated_at: 2026-08-20T00:30:00+08:00\n"),
        "{text}"
    );
    assert!(!text.contains("00Z"), "{text}");
    assert!(summary.created_at.starts_with("2026-08-20"));
}

#[test]
fn writes_only_title_and_times_without_category_or_tags() {
    let vault = Vault::create();

    vault
        .create_article("Zen of Writing", &[], &[])
        .expect("created");

    assert_eq!(
        vault.text_of("Blog/zen-of-writing.md"),
        "---\ntitle: Zen of Writing\ncreated_at: 2026-08-20T14:32:05+00:00\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n"
    );
}

#[test]
fn trims_drops_blank_and_repeated_categories() {
    let vault = Vault::create();

    let summary = vault
        .create_article("Zen", &["  技術筆記  ", "", "技術筆記", "桌面開發"], &[])
        .expect("created");

    assert_eq!(summary.category, ["技術筆記", "桌面開發"]);
    assert!(
        vault
            .text_of("Blog/zen.md")
            .contains("category:\n  - 技術筆記\n  - 桌面開發\n")
    );
}

#[test]
fn answers_with_the_row_the_file_itself_describes() {
    let vault = Vault::create();

    let summary = vault
        .create_article("  Zen of Writing  ", &[], &["electron"])
        .expect("created");

    assert_eq!(
        serde_json::to_value(&summary).expect("serializable"),
        json!({
            "fileName": "zen-of-writing.md",
            "title": "Zen of Writing",
            "createdAt": "2026-08-20T14:32:05+00:00",
            "category": [],
            "tags": ["electron"],
            "hasIncompleteMetadata": false,
        })
    );
    let workspaces = FileSystemWorkspaceRepository::in_vault(Vault::scope_at(&vault.root));
    let articles = FileSystemArticleRepository::in_vault(Vault::scope_at(&vault.root));
    let listed = ListArticles::new(&workspaces, &articles)
        .execute(&WorkspaceName::parse("Blog").expect("valid workspace name"))
        .expect("listed");
    assert_eq!(listed, vec![summary]);
}

#[test]
fn numbers_a_taken_name_and_leaves_the_existing_article_untouched() {
    let vault = Vault::create();
    vault.file("Blog/zen-of-writing.md", "別人的文章");

    let summary = vault
        .create_article("Zen of Writing", &[], &[])
        .expect("created");

    assert_eq!(summary.file_name, "zen-of-writing-2.md");
    assert_eq!(vault.text_of("Blog/zen-of-writing.md"), "別人的文章");
}

#[test]
fn counts_a_folder_as_a_taken_name() {
    let vault = Vault::create();
    fs::create_dir(vault.root.join("Blog/notes.md")).expect("folder");

    let summary = vault.create_article("Notes", &[], &[]).expect("created");

    assert_eq!(summary.file_name, "notes-2.md");
}

#[test]
fn creates_nothing_for_a_blank_title() {
    let vault = Vault::create();
    vault.file("Blog/zen-of-writing.md", "正文");

    let created = vault.create_article("   ", &["技術筆記"], &[]);

    assert_eq!(
        created,
        Err(CreateArticleError::Draft(ArticleDraftError::BlankTitle))
    );
    assert_eq!(
        Vault::names_in(&vault.root.join("Blog")),
        vec!["zen-of-writing.md"]
    );
}

#[cfg(unix)]
#[test]
fn refuses_a_workspace_that_links_outside_the_vault_and_writes_nothing_there() {
    let vault = Vault::create();
    let outside = vault.directory.path().join("outside");
    fs::create_dir_all(&outside).expect("outside folder");
    std::os::unix::fs::symlink(&outside, vault.root.join("Escape")).expect("symlink");

    let created = vault.create_article_at(&vault.root, "Escape", "Zen", &[], &[]);

    assert!(matches!(
        created,
        Err(CreateArticleError::Workspace(
            WorkspaceRepositoryError::OutsideVault(_)
        )) | Err(CreateArticleError::Article(
            ArticleRepositoryError::OutsideVault(_)
        ))
    ));
    assert!(Vault::names_in(&outside).is_empty());
}

#[cfg(unix)]
#[test]
fn creates_through_a_workspace_link_inside_the_vault() {
    let vault = Vault::create();
    std::os::unix::fs::symlink(vault.root.join("Blog"), vault.root.join("Mirror"))
        .expect("symlink");

    vault
        .create_article_at(&vault.root, "Mirror", "Zen of Writing", &[], &[])
        .expect("created");

    assert!(vault.root.join("Blog/zen-of-writing.md").is_file());
}

#[cfg(unix)]
#[test]
fn creates_in_a_vault_reached_through_a_symlink() {
    let vault = Vault::create();
    let linked_vault = vault.directory.path().join("linked-vault");
    std::os::unix::fs::symlink(&vault.root, &linked_vault).expect("symlink");

    vault
        .create_article_at(&linked_vault, "Blog", "Zen of Writing", &[], &[])
        .expect("created");

    assert!(vault.root.join("Blog/zen-of-writing.md").is_file());
}
