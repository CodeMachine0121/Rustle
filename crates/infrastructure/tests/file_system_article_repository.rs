use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use rustle_domain::{
    ArticleFileName, ArticleRepository, ArticleRepositoryError, ArticleWrite, StoredArticle,
    VaultPathError, VaultScope, WorkspaceName,
};
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use tempfile::TempDir;

struct Vault {
    directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        Self { directory, root }
    }

    fn outside(&self) -> PathBuf {
        let outside = self.directory.path().join("outside");
        fs::create_dir_all(&outside).expect("folder outside the vault");
        outside
    }

    fn write(&self, relative_path: &str, text: &str) -> PathBuf {
        let path = self.root.join(relative_path);
        fs::write(&path, text).expect("article written");
        path
    }

    fn articles_at(root: &Path) -> FileSystemArticleRepository {
        FileSystemArticleRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(root)))
    }

    fn articles(&self) -> FileSystemArticleRepository {
        Self::articles_at(&self.root)
    }
}

fn read(
    articles: &FileSystemArticleRepository,
    workspace: &str,
    article: &str,
) -> Result<StoredArticle, ArticleRepositoryError> {
    articles.read(
        &WorkspaceName::parse(workspace).expect("valid workspace name"),
        &ArticleFileName::parse(article).expect("valid article name"),
    )
}

fn write(
    articles: &FileSystemArticleRepository,
    workspace: &str,
    article: &str,
    text: &str,
    expected_modified_at: &str,
) -> Result<ArticleWrite, ArticleRepositoryError> {
    articles.write(
        &WorkspaceName::parse(workspace).expect("valid workspace name"),
        &ArticleFileName::parse(article).expect("valid article name"),
        text,
        expected_modified_at,
    )
}

fn last_modified_at(articles: &FileSystemArticleRepository, article: &str) -> String {
    read(articles, "Blog", article)
        .expect("readable")
        .last_modified_at
}

fn set_modified(path: &Path, modified: SystemTime) {
    fs::File::options()
        .write(true)
        .open(path)
        .and_then(|file| file.set_modified(modified))
        .expect("modification time set");
}

fn file_names_in(folder: &Path) -> Vec<String> {
    let mut names: Vec<String> = fs::read_dir(folder)
        .expect("listable folder")
        .map(|entry| {
            entry
                .expect("folder entry")
                .file_name()
                .to_string_lossy()
                .into_owned()
        })
        .collect();
    names.sort_unstable();
    names
}

#[test]
fn reads_the_text_and_modification_time_of_an_article() {
    let vault = Vault::create();
    let path = vault.write("Blog/zen-of-writing.md", "---\ntitle: Zen\n---\n正文\n");
    let modified = SystemTime::UNIX_EPOCH + Duration::from_millis(1_787_213_051_123);
    fs::File::options()
        .write(true)
        .open(&path)
        .and_then(|file| file.set_modified(modified))
        .expect("modification time set");

    let stored = read(&vault.articles(), "Blog", "zen-of-writing.md");

    assert_eq!(
        stored,
        Ok(StoredArticle {
            text: "---\ntitle: Zen\n---\n正文\n".to_owned(),
            last_modified_at: "2026-08-20T08:04:11.123Z".to_owned(),
        })
    );
}

#[cfg(unix)]
#[test]
fn reads_a_vault_that_sits_behind_a_symlink() {
    let vault = Vault::create();
    vault.write("Blog/zen-of-writing.md", "正文\n");
    let link_to_vault = vault.directory.path().join("linked-vault");
    std::os::unix::fs::symlink(&vault.root, &link_to_vault).expect("symlink to the vault");

    let stored = read(
        &Vault::articles_at(&link_to_vault),
        "Blog",
        "zen-of-writing.md",
    );

    assert_eq!(stored.map(|stored| stored.text), Ok("正文\n".to_owned()));
}

#[cfg(unix)]
#[test]
fn refuses_an_article_that_links_outside_the_vault() {
    let vault = Vault::create();
    let secret = vault.outside().join("secret.md");
    fs::write(&secret, "秘密").expect("file outside the vault");
    std::os::unix::fs::symlink(&secret, vault.root.join("Blog/escape.md")).expect("symlink");

    let stored = read(&vault.articles(), "Blog", "escape.md");

    assert_eq!(
        stored,
        Err(ArticleRepositoryError::OutsideVault(
            VaultPathError::OutsideVault {
                rejected: "Blog/escape.md".to_owned()
            }
        ))
    );
}

#[cfg(unix)]
#[test]
fn refuses_a_workspace_that_links_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside();
    fs::write(outside.join("article.md"), "秘密").expect("file outside the vault");
    std::os::unix::fs::symlink(&outside, vault.root.join("Escaped")).expect("symlink");

    let stored = read(&vault.articles(), "Escaped", "article.md");

    assert!(matches!(
        stored,
        Err(ArticleRepositoryError::OutsideVault(_))
    ));
}

#[test]
fn fails_clearly_when_the_article_does_not_exist() {
    let vault = Vault::create();

    let stored = read(&vault.articles(), "Blog", "missing.md");

    match stored {
        Err(ArticleRepositoryError::Unreadable { article, .. }) => {
            assert_eq!(article, "Blog/missing.md");
        }
        other => panic!("expected an unreadable article, got {other:?}"),
    }
}

#[test]
fn fails_on_a_file_that_is_not_text() {
    let vault = Vault::create();
    fs::write(vault.root.join("Blog/binary.md"), [0xff, 0xfe, 0x00]).expect("binary file");

    let stored = read(&vault.articles(), "Blog", "binary.md");

    assert!(matches!(
        stored,
        Err(ArticleRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn writes_the_new_text_and_reports_the_new_modification_time() {
    let vault = Vault::create();
    let path = vault.write("Blog/zen.md", "舊的正文\n");
    set_modified(&path, SystemTime::UNIX_EPOCH + Duration::from_secs(1_000));
    let articles = vault.articles();
    let loaded_at = last_modified_at(&articles, "zen.md");

    let outcome = write(&articles, "Blog", "zen.md", "新的正文\n", &loaded_at);

    assert_eq!(fs::read_to_string(&path).expect("readable"), "新的正文\n");
    assert_eq!(
        outcome,
        Ok(ArticleWrite::Written {
            modified_at: last_modified_at(&articles, "zen.md")
        })
    );
    assert_ne!(last_modified_at(&articles, "zen.md"), loaded_at);
}

#[test]
fn leaves_only_the_article_in_its_workspace_after_writing() {
    let vault = Vault::create();
    vault.write("Blog/zen.md", "舊的正文\n");
    let articles = vault.articles();
    let loaded_at = last_modified_at(&articles, "zen.md");

    write(&articles, "Blog", "zen.md", "新的正文\n", &loaded_at).expect("written");

    assert_eq!(file_names_in(&vault.root.join("Blog")), vec!["zen.md"]);
}

#[test]
fn refuses_to_write_over_a_file_changed_after_it_was_loaded() {
    let vault = Vault::create();
    let path = vault.write("Blog/zen.md", "載入時的正文\n");
    let articles = vault.articles();
    let loaded_at = last_modified_at(&articles, "zen.md");
    fs::write(&path, "Obsidian 改過的正文\n").expect("outside edit");
    set_modified(&path, SystemTime::now() + Duration::from_secs(60));

    let outcome = write(&articles, "Blog", "zen.md", "Rustle 的正文\n", &loaded_at);

    assert_eq!(outcome, Ok(ArticleWrite::ModifiedElsewhere));
    assert_eq!(
        fs::read_to_string(&path).expect("readable"),
        "Obsidian 改過的正文\n"
    );
    assert_eq!(file_names_in(&vault.root.join("Blog")), vec!["zen.md"]);
}

#[test]
fn fails_to_write_an_article_that_does_not_exist_and_creates_nothing() {
    let vault = Vault::create();

    let outcome = write(
        &vault.articles(),
        "Blog",
        "deleted.md",
        "正文",
        "2026-08-20T08:04:11.123Z",
    );

    assert!(matches!(
        outcome,
        Err(ArticleRepositoryError::Unwritable { ref article, .. }) if article == "Blog/deleted.md"
    ));
    assert!(file_names_in(&vault.root.join("Blog")).is_empty());
}

#[cfg(unix)]
#[test]
fn keeps_the_article_byte_for_byte_when_its_folder_cannot_be_written() {
    use std::os::unix::fs::PermissionsExt;

    let vault = Vault::create();
    let original = "---\ntitle: 原本\n---\n原本的正文\n";
    let path = vault.write("Blog/zen.md", original);
    let articles = vault.articles();
    let loaded_at = last_modified_at(&articles, "zen.md");
    let workspace = vault.root.join("Blog");
    fs::set_permissions(&workspace, fs::Permissions::from_mode(0o555)).expect("read-only folder");

    let outcome = write(&articles, "Blog", "zen.md", "新的正文\n", &loaded_at);

    fs::set_permissions(&workspace, fs::Permissions::from_mode(0o755)).expect("writable again");
    assert!(matches!(
        outcome,
        Err(ArticleRepositoryError::Unwritable { .. })
    ));
    assert_eq!(fs::read(&path).expect("readable"), original.as_bytes());
    assert_eq!(file_names_in(&workspace), vec!["zen.md"]);
}

#[cfg(unix)]
#[test]
fn replaces_a_read_only_article_and_keeps_it_read_only() {
    use std::os::unix::fs::PermissionsExt;

    let vault = Vault::create();
    let path = vault.write("Blog/zen.md", "舊的正文\n");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o444)).expect("read-only file");
    let articles = vault.articles();
    let loaded_at = last_modified_at(&articles, "zen.md");

    write(&articles, "Blog", "zen.md", "新的正文\n", &loaded_at).expect("written");

    assert_eq!(fs::read_to_string(&path).expect("readable"), "新的正文\n");
    let mode = fs::metadata(&path).expect("metadata").permissions().mode();
    assert_eq!(mode & 0o777, 0o444);
}

#[cfg(unix)]
#[test]
fn writes_through_a_link_inside_the_vault_to_the_article_it_points_to() {
    let vault = Vault::create();
    let target = vault.write("Blog/zen.md", "舊的正文\n");
    fs::create_dir_all(vault.root.join("Notes")).expect("second workspace");
    let link = vault.root.join("Notes/zen-link.md");
    std::os::unix::fs::symlink(&target, &link).expect("symlink inside the vault");
    let articles = vault.articles();
    let loaded_at = read(&articles, "Notes", "zen-link.md")
        .expect("readable through the link")
        .last_modified_at;

    write(&articles, "Notes", "zen-link.md", "新的正文\n", &loaded_at).expect("written");

    assert_eq!(fs::read_to_string(&target).expect("readable"), "新的正文\n");
    assert!(
        fs::symlink_metadata(&link)
            .expect("link metadata")
            .file_type()
            .is_symlink()
    );
}

#[cfg(unix)]
#[test]
fn refuses_to_write_through_a_link_that_leaves_the_vault() {
    let vault = Vault::create();
    let secret = vault.outside().join("secret.md");
    fs::write(&secret, "秘密").expect("file outside the vault");
    std::os::unix::fs::symlink(&secret, vault.root.join("Blog/escape.md")).expect("symlink");
    let outcome = write(
        &vault.articles(),
        "Blog",
        "escape.md",
        "覆寫",
        "2026-08-20T08:04:11.123Z",
    );

    assert!(matches!(
        outcome,
        Err(ArticleRepositoryError::OutsideVault(_))
    ));
    assert_eq!(fs::read_to_string(&secret).expect("readable"), "秘密");
}
