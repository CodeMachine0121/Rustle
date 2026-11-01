use std::fs;
use std::path::PathBuf;

use rstest::rstest;
use rustle_application::{
    ArticleSummary, CreateWorkspace, CreateWorkspaceOutcome, ListArticles, ListWorkspaces,
    ReadSettings, WorkspaceSummary,
};
use rustle_domain::{
    Settings, SettingsError, VaultScope, WorkspaceName, WorkspaceNameRejection,
    WorkspaceRepositoryError,
};
use rustle_infrastructure::{
    FileSystemArticleRepository, FileSystemSettingsRepository, FileSystemWorkspaceRepository,
    ResolvedVaultScope,
};
use serde_json::json;
use tempfile::TempDir;

struct Vault {
    directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(&root).expect("vault root");
        Self { directory, root }
    }

    fn missing() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        Self { directory, root }
    }

    fn folder(&self, relative_path: &str) -> &Self {
        fs::create_dir_all(self.root.join(relative_path)).expect("folder");
        self
    }

    fn file(&self, relative_path: &str, contents: &str) -> &Self {
        fs::write(self.root.join(relative_path), contents).expect("file");
        self
    }

    fn outside(&self) -> PathBuf {
        let outside = self.directory.path().join("outside");
        fs::create_dir_all(&outside).expect("folder outside the vault");
        outside
    }

    fn scope(&self) -> ResolvedVaultScope {
        ResolvedVaultScope::new(VaultScope::new(&self.root))
    }

    fn workspaces(&self) -> FileSystemWorkspaceRepository {
        FileSystemWorkspaceRepository::in_vault(self.scope())
    }

    fn list_workspaces(&self) -> Vec<WorkspaceSummary> {
        ListWorkspaces::new(&self.workspaces())
            .execute()
            .expect("workspaces listed")
    }

    fn workspace_names(&self) -> Vec<String> {
        self.list_workspaces()
            .into_iter()
            .map(|workspace| workspace.name)
            .collect()
    }

    fn list_articles(&self, workspace: &str) -> Vec<ArticleSummary> {
        let articles = FileSystemArticleRepository::in_vault(self.scope());
        ListArticles::new(&self.workspaces(), &articles)
            .execute(&WorkspaceName::parse(workspace).expect("valid workspace name"))
            .expect("articles listed")
    }

    fn article_file_names(&self, workspace: &str) -> Vec<String> {
        self.list_articles(workspace)
            .into_iter()
            .map(|article| article.file_name)
            .collect()
    }

    fn create_workspace(&self, typed_name: &str) -> CreateWorkspaceOutcome {
        CreateWorkspace::new(&self.workspaces())
            .execute(typed_name)
            .expect("vault reachable")
    }

    fn entry_names(&self) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(&self.root)
            .expect("vault listed")
            .map(|entry| {
                entry
                    .expect("entry")
                    .file_name()
                    .to_string_lossy()
                    .into_owned()
            })
            .collect();
        names.sort();
        names
    }

    fn read_settings(&self) -> Result<Settings, SettingsError> {
        ReadSettings::new(&FileSystemSettingsRepository::in_vault(self.scope())).execute()
    }
}

#[test]
fn lists_the_folders_of_the_vault_in_name_order() {
    let vault = Vault::create();
    vault.folder("work").folder("Blog").folder("Reading-Notes");

    assert_eq!(vault.workspace_names(), ["Blog", "Reading-Notes", "work"]);
}

#[test]
fn hidden_folders_reserved_folders_and_files_are_not_workspaces() {
    let vault = Vault::create();
    vault
        .folder(".rustle")
        .folder(".git")
        .folder("images")
        .folder("Blog")
        .file("README.txt", "read me")
        .file("Blog.md", "# not a workspace");

    assert_eq!(vault.workspace_names(), ["Blog"]);
}

#[cfg(unix)]
#[test]
fn a_linked_folder_inside_the_vault_is_a_workspace_and_escaping_links_are_not_listed() {
    use std::os::unix::fs::symlink;

    let vault = Vault::create();
    vault.folder("Real").file("real.txt", "text");
    let outside = vault.outside();
    fs::write(outside.join("secret.txt"), "secret").expect("file outside");
    symlink(vault.root.join("Real"), vault.root.join("LinkedFolder")).expect("symlink");
    symlink(vault.root.join("real.txt"), vault.root.join("LinkedFile")).expect("symlink");
    symlink(&outside, vault.root.join("EscapingFolder")).expect("symlink");
    symlink(outside.join("secret.txt"), vault.root.join("EscapingFile")).expect("symlink");
    symlink(vault.root.join("nowhere"), vault.root.join("Dangling")).expect("symlink");

    assert_eq!(vault.workspace_names(), ["LinkedFolder", "Real"]);
}

#[test]
fn each_workspace_carries_its_article_count() {
    let vault = Vault::create();
    vault
        .folder("Blog/images")
        .file("Blog/a.md", "a")
        .file("Blog/b.md", "b")
        .folder("Work")
        .file("Work/notes.txt", "not an article");

    assert_eq!(
        vault.list_workspaces(),
        vec![
            WorkspaceSummary {
                name: "Blog".to_owned(),
                article_count: 2
            },
            WorkspaceSummary {
                name: "Work".to_owned(),
                article_count: 0
            },
        ]
    );
}

#[test]
fn a_vault_without_workspaces_lists_nothing() {
    let vault = Vault::create();
    vault.folder(".rustle").file("README.txt", "read me");

    assert_eq!(vault.list_workspaces(), Vec::new());
}

#[test]
fn a_vault_that_does_not_exist_yet_lists_nothing() {
    assert_eq!(Vault::missing().list_workspaces(), Vec::new());
}

#[test]
fn lists_the_markdown_files_of_the_first_level_only() {
    let vault = Vault::create();
    vault
        .folder("Blog/images")
        .folder("Blog/2026")
        .file("Blog/2026/nested.md", "nested")
        .folder("Blog/notes.md")
        .file("Blog/zen-of-writing.md", "zen")
        .file("Blog/TAURI-VS-ELECTRON.MD", "tauri")
        .file("Blog/README.txt", "read me")
        .file("Blog/.DS_Store", "finder");

    assert_eq!(
        vault.article_file_names("Blog"),
        ["TAURI-VS-ELECTRON.MD", "zen-of-writing.md"]
    );
    assert_eq!(
        fs::read_to_string(vault.root.join("Blog/README.txt")).expect("still there"),
        "read me"
    );
    assert_eq!(
        fs::read_to_string(vault.root.join("Blog/.DS_Store")).expect("still there"),
        "finder"
    );
}

#[test]
fn orders_articles_by_file_name_ignoring_case() {
    let vault = Vault::create();
    vault
        .folder("Blog")
        .file("Blog/b.md", "b")
        .file("Blog/a.md", "a")
        .file("Blog/C.md", "c");

    assert_eq!(vault.article_file_names("Blog"), ["a.md", "b.md", "C.md"]);
}

#[test]
fn each_row_carries_what_the_article_says_about_itself() {
    let vault = Vault::create();
    vault.folder("Blog").file(
        "Blog/tauri.md",
        "---\ntitle: Tauri 與 Electron 的取捨\ncreated_at: 2026-08-20T14:32:05+08:00\ncategory: 技術筆記\ntags:\n  - tauri\n  - electron\n---\n正文\n",
    );

    assert_eq!(
        vault.list_articles("Blog"),
        vec![ArticleSummary {
            file_name: "tauri.md".to_owned(),
            title: "Tauri 與 Electron 的取捨".to_owned(),
            created_at: "2026-08-20T14:32:05+08:00".to_owned(),
            category: vec!["技術筆記".to_owned()],
            tags: vec!["tauri".to_owned(), "electron".to_owned()],
            has_incomplete_metadata: false,
        }]
    );
}

#[rstest]
#[case::without_front_matter("no-title.md", "# 隨手寫的東西\n".as_bytes(), "no-title")]
#[case::unreadable("unreadable.md", &[0xff, 0xfe, 0x00], "unreadable")]
fn an_article_without_a_title_is_titled_by_its_file_name_and_marked(
    #[case] file_name: &str,
    #[case] contents: &[u8],
    #[case] title: &str,
) {
    let vault = Vault::create();
    vault.folder("Blog");
    fs::write(vault.root.join("Blog").join(file_name), contents).expect("article");

    let articles = vault.list_articles("Blog");

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].title, title);
    assert!(articles[0].has_incomplete_metadata);
    assert!(articles[0].created_at.is_empty());
    assert!(articles[0].category.is_empty() && articles[0].tags.is_empty());
}

#[cfg(unix)]
#[test]
fn a_linked_article_inside_the_vault_is_listed_and_one_outside_is_not() {
    use std::os::unix::fs::symlink;

    let vault = Vault::create();
    vault
        .folder("Drafts")
        .file("Drafts/real.md", "---\ntitle: 真的那篇\n---\n");
    vault.folder("Blog");
    let outside = vault.outside().join("secret.md");
    fs::write(&outside, "---\ntitle: 秘密\n---\n").expect("file outside");
    symlink(
        vault.root.join("Drafts/real.md"),
        vault.root.join("Blog/link-inside.md"),
    )
    .expect("symlink");
    symlink(&outside, vault.root.join("Blog/link-outside.md")).expect("symlink");

    let articles = vault.list_articles("Blog");

    assert_eq!(articles.len(), 1);
    assert_eq!(articles[0].file_name, "link-inside.md");
    assert_eq!(articles[0].title, "真的那篇");
}

#[test]
fn a_workspace_with_only_an_images_folder_lists_nothing() {
    let vault = Vault::create();
    vault.folder("Work/images");

    assert_eq!(vault.list_articles("Work"), Vec::new());
}

#[test]
fn lists_all_of_five_hundred_articles() {
    let vault = Vault::create();
    vault.folder("Big");
    for number in 0..500 {
        vault.file(
            &format!("Big/article-{number:03}.md"),
            &format!("---\ntitle: 第 {number} 篇\n---\n正文\n"),
        );
    }

    let articles = vault.list_articles("Big");

    assert_eq!(articles.len(), 500);
    assert!(articles.iter().all(|article| !article.title.is_empty()));
}

#[test]
fn creates_a_workspace_with_no_articles() {
    let vault = Vault::create();

    let outcome = vault.create_workspace("Notes");

    assert_eq!(
        outcome,
        CreateWorkspaceOutcome::Created {
            workspace: WorkspaceSummary {
                name: "Notes".to_owned(),
                article_count: 0
            }
        }
    );
    assert!(vault.root.join("Notes").is_dir());
}

#[test]
fn creates_the_first_workspace_of_a_vault_that_does_not_exist_yet() {
    let vault = Vault::missing();

    vault.create_workspace("Notes");

    assert!(vault.root.join("Notes").is_dir());
}

#[rstest]
#[case("Blog", WorkspaceNameRejection::AlreadyUsed)]
#[case("blog", WorkspaceNameRejection::AlreadyUsed)]
#[case("README.txt", WorkspaceNameRejection::AlreadyUsed)]
#[case("Blog/2026", WorkspaceNameRejection::ContainsPathSeparator)]
#[case("Blog\\2026", WorkspaceNameRejection::ContainsPathSeparator)]
#[case("images", WorkspaceNameRejection::Reserved)]
#[case("Images", WorkspaceNameRejection::Reserved)]
#[case("", WorkspaceNameRejection::Empty)]
#[case("   ", WorkspaceNameRejection::Empty)]
#[case(".hidden", WorkspaceNameRejection::Reserved)]
#[case(".", WorkspaceNameRejection::Reserved)]
#[case("..", WorkspaceNameRejection::Reserved)]
fn a_rejected_name_says_why_and_creates_nothing(
    #[case] typed_name: &str,
    #[case] reason: WorkspaceNameRejection,
) {
    let vault = Vault::create();
    vault.folder("Blog").file("README.txt", "read me");

    let outcome = vault.create_workspace(typed_name);

    assert_eq!(outcome, CreateWorkspaceOutcome::Rejected { reason });
    assert_eq!(vault.entry_names(), ["Blog", "README.txt"]);
    assert_eq!(
        fs::read_dir(vault.root.join("Blog")).expect("Blog").count(),
        0
    );
}

#[test]
fn a_rejection_reaches_the_webview_as_an_outcome_with_a_reason() {
    let vault = Vault::create();

    let outcome = serde_json::to_value(vault.create_workspace("images")).expect("serializable");

    assert_eq!(
        outcome,
        json!({ "outcome": "rejected", "reason": "reserved" })
    );
}

#[test]
fn a_new_workspace_reaches_the_webview_with_its_summary() {
    let vault = Vault::create();

    let outcome = serde_json::to_value(vault.create_workspace("Notes")).expect("serializable");

    assert_eq!(
        outcome,
        json!({ "outcome": "created", "workspace": { "name": "Notes", "articleCount": 0 } })
    );
}

#[test]
fn a_vault_that_cannot_hold_folders_is_an_error_not_a_rejection() {
    let directory = TempDir::new().expect("temporary directory");
    let root = directory.path().join("Rustle");
    fs::write(&root, "a file where the vault should be").expect("blocking file");
    let workspaces =
        FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(&root)));

    assert!(matches!(
        CreateWorkspace::new(&workspaces).execute("Notes"),
        Err(WorkspaceRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn reads_defaults_when_there_is_no_settings_file() {
    assert_eq!(Vault::create().read_settings(), Ok(Settings::default()));
}

#[test]
fn reads_defaults_when_the_settings_file_is_not_json() {
    let vault = Vault::create();
    vault
        .folder(".rustle")
        .file(".rustle/settings.json", "{ 這不是 json");

    assert_eq!(vault.read_settings(), Ok(Settings::default()));
}

#[cfg(unix)]
#[test]
fn refuses_a_settings_folder_that_links_outside_the_vault() {
    let vault = Vault::create();
    std::os::unix::fs::symlink(vault.outside(), vault.root.join(".rustle")).expect("symlink");

    assert!(matches!(
        vault.read_settings(),
        Err(SettingsError::OutsideVault(_))
    ));
}

#[cfg(unix)]
fn with_permissions(path: &std::path::Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(mode)).expect("permissions");
}

#[cfg(unix)]
#[test]
fn a_vault_that_refuses_new_folders_is_an_error_not_a_rejection() {
    let vault = Vault::create();
    with_permissions(&vault.root, 0o555);

    let result = CreateWorkspace::new(&vault.workspaces()).execute("Notes");

    with_permissions(&vault.root, 0o755);
    assert!(matches!(
        result,
        Err(WorkspaceRepositoryError::Unwritable { .. })
    ));
}

#[cfg(unix)]
#[test]
fn a_workspace_that_cannot_be_read_is_reported_instead_of_counted_as_empty() {
    let vault = Vault::create();
    vault.folder("Locked");
    with_permissions(&vault.root.join("Locked"), 0o000);

    let result = ListWorkspaces::new(&vault.workspaces()).execute();

    with_permissions(&vault.root.join("Locked"), 0o755);
    assert!(matches!(
        result,
        Err(WorkspaceRepositoryError::Unreadable { .. })
    ));
}

#[cfg(unix)]
#[test]
fn refuses_to_list_the_articles_of_a_workspace_linked_outside_the_vault() {
    let vault = Vault::create();
    std::os::unix::fs::symlink(vault.outside(), vault.root.join("Escaped")).expect("symlink");
    let articles = FileSystemArticleRepository::in_vault(vault.scope());

    let result = ListArticles::new(&vault.workspaces(), &articles)
        .execute(&WorkspaceName::parse("Escaped").expect("valid workspace name"));

    assert!(matches!(
        result,
        Err(WorkspaceRepositoryError::OutsideVault(_))
    ));
}
