use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use rustle_domain::{
    ArticleFileName, ArticleRepository, ArticleRepositoryError, StoredArticle, VaultPathError,
    VaultScope, WorkspaceName,
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
