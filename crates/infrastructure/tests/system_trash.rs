#![cfg(unix)]

use std::fs;
use std::path::PathBuf;

use rustle_domain::{ArticleFileName, Trash, TrashError, VaultScope, WorkspaceName};
use rustle_infrastructure::{ResolvedVaultScope, SystemTrash};
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

    fn outside_folder_linked_as(&self, link_name: &str) -> PathBuf {
        let outside = self.directory.path().join("outside");
        fs::create_dir_all(&outside).expect("folder outside the vault");
        fs::write(outside.join("a.md"), "outside").expect("file outside the vault");
        std::os::unix::fs::symlink(&outside, self.root.join(link_name)).expect("link");
        outside
    }

    fn trash(&self) -> SystemTrash {
        SystemTrash::in_vault(ResolvedVaultScope::new(VaultScope::new(&self.root)))
    }
}

fn workspace(name: &str) -> WorkspaceName {
    WorkspaceName::parse(name).expect("valid workspace name")
}

fn article(name: &str) -> ArticleFileName {
    ArticleFileName::parse(name).expect("valid article name")
}

#[test]
fn refuses_an_article_in_a_workspace_linked_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside_folder_linked_as("Escape");

    let refused = vault
        .trash()
        .move_article_to_trash(&workspace("Escape"), &article("a.md"));

    assert!(matches!(refused, Err(TrashError::OutsideVault(_))));
    assert_eq!(
        fs::read_to_string(outside.join("a.md")).expect("still there"),
        "outside"
    );
}

#[test]
fn refuses_a_workspace_linked_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside_folder_linked_as("Escape");

    let refused = vault.trash().move_workspace_to_trash(&workspace("Escape"));

    assert!(matches!(refused, Err(TrashError::OutsideVault(_))));
    assert!(outside.join("a.md").exists());
    assert!(vault.root.join("Escape").exists());
}

#[test]
fn a_missing_article_is_not_moved_and_is_named_without_its_path() {
    let vault = Vault::create();

    let refused = vault
        .trash()
        .move_article_to_trash(&workspace("Blog"), &article("missing.md"));

    let Err(TrashError::NotMoved { item, .. }) = refused else {
        panic!("expected a missing article to be refused, got {refused:?}");
    };
    assert_eq!(item, "Blog/missing.md");
}

#[test]
fn a_missing_workspace_is_not_moved() {
    let vault = Vault::create();

    let refused = vault.trash().move_workspace_to_trash(&workspace("Gone"));

    assert!(matches!(refused, Err(TrashError::NotMoved { item, .. }) if item == "Gone"));
}
