use std::fs;
use std::path::PathBuf;

use mockall::predicate::eq;
use rstest::rstest;
use rustle_application::{
    CountWorkspaceContents, DeleteWorkspace, DeleteWorkspaceError, RenameWorkspace,
    RenameWorkspaceOutcome, WorkspaceContents,
};
use rustle_domain::{
    MockTrash, TrashError, VaultScope, WorkspaceName, WorkspaceNameRejection,
    WorkspaceRepositoryError,
};
use rustle_infrastructure::{FileSystemWorkspaceRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

struct Vault {
    _directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(&root).expect("vault root");
        Self {
            _directory: directory,
            root,
        }
    }

    fn folder(&self, relative_path: &str) -> &Self {
        fs::create_dir_all(self.root.join(relative_path)).expect("folder");
        self
    }

    fn file(&self, relative_path: &str) -> &Self {
        let path = self.root.join(relative_path);
        if let Some(folder) = path.parent() {
            fs::create_dir_all(folder).expect("folder");
        }
        fs::write(path, "text").expect("file");
        self
    }

    fn workspaces(&self) -> FileSystemWorkspaceRepository {
        FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(
            &self.root,
        )))
    }

    fn count(&self, workspace: &str) -> Result<WorkspaceContents, WorkspaceRepositoryError> {
        CountWorkspaceContents::new(&self.workspaces()).execute(&name(workspace))
    }

    fn rename(&self, workspace: &str, typed: &str) -> RenameWorkspaceOutcome {
        RenameWorkspace::new(&self.workspaces())
            .execute(&name(workspace), typed)
            .expect("vault readable")
    }

    fn folder_names(&self) -> Vec<String> {
        let mut names: Vec<String> = fs::read_dir(&self.root)
            .expect("vault readable")
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
}

fn name(workspace: &str) -> WorkspaceName {
    WorkspaceName::parse(workspace).expect("valid workspace name")
}

fn contents(article_count: usize, image_count: usize) -> WorkspaceContents {
    WorkspaceContents {
        article_count,
        image_count,
    }
}

#[test]
fn counts_first_level_articles_and_visible_images() {
    let vault = Vault::create();
    vault
        .file("Blog/a.md")
        .file("Blog/b.md")
        .file("Blog/README.txt")
        .file("Blog/images/1.png")
        .file("Blog/images/2.png")
        .file("Blog/images/.DS_Store");

    assert_eq!(vault.count("Blog"), Ok(contents(2, 2)));
}

#[test]
fn counts_no_images_when_there_is_no_images_folder() {
    let vault = Vault::create();
    vault.file("Blog/a.md");

    assert_eq!(vault.count("Blog"), Ok(contents(1, 0)));
}

#[test]
fn does_not_count_articles_or_images_in_nested_folders() {
    let vault = Vault::create();
    vault
        .file("Blog/a.md")
        .file("Blog/2026/b.md")
        .file("Blog/images/2026/1.png");

    assert_eq!(vault.count("Blog"), Ok(contents(1, 0)));
}

#[cfg(unix)]
#[test]
fn a_workspace_that_cannot_be_read_cannot_be_counted() {
    use std::os::unix::fs::PermissionsExt;
    let vault = Vault::create();
    vault.file("Blog/a.md");
    let folder = vault.root.join("Blog");
    fs::set_permissions(&folder, fs::Permissions::from_mode(0o000)).expect("locked");

    let counted = vault.count("Blog");

    fs::set_permissions(&folder, fs::Permissions::from_mode(0o755)).expect("unlocked");
    assert!(matches!(
        counted,
        Err(WorkspaceRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn sends_the_counts_in_camel_case() {
    assert_eq!(
        serde_json::to_value(contents(2, 3)).expect("serializable"),
        json!({ "articleCount": 2, "imageCount": 3 })
    );
}

#[test]
fn deletes_the_whole_workspace_through_the_trash_and_answers_with_what_went() {
    let vault = Vault::create();
    vault.file("Blog/a.md").file("Blog/images/1.png");
    let mut trash = MockTrash::new();
    trash
        .expect_move_workspace_to_trash()
        .with(eq(name("Blog")))
        .times(1)
        .returning(|_| Ok(()));
    trash.expect_move_article_to_trash().never();

    let deleted = DeleteWorkspace::new(&vault.workspaces(), &trash).execute(&name("Blog"));

    assert_eq!(deleted, Ok(contents(1, 1)));
}

#[test]
fn reports_why_the_trash_refused_a_workspace() {
    let vault = Vault::create();
    vault.folder("Blog");
    let mut trash = MockTrash::new();
    trash.expect_move_workspace_to_trash().returning(|_| {
        Err(TrashError::NotMoved {
            item: "Blog".to_owned(),
            reason: "Permission denied".to_owned(),
        })
    });

    let refused = DeleteWorkspace::new(&vault.workspaces(), &trash).execute(&name("Blog"));

    assert!(matches!(refused, Err(DeleteWorkspaceError::Trash(_))));
}

#[test]
fn renames_the_folder_in_place_and_keeps_its_articles() {
    let vault = Vault::create();
    vault.file("Blog/a.md");

    let outcome = vault.rename("Blog", "Writing");

    assert_eq!(
        outcome,
        RenameWorkspaceOutcome::Renamed {
            workspace: "Writing".to_owned()
        }
    );
    assert_eq!(vault.folder_names(), ["Writing"]);
    assert!(vault.root.join("Writing/a.md").exists());
}

#[rstest]
#[case("", WorkspaceNameRejection::Empty)]
#[case("a/b", WorkspaceNameRejection::ContainsPathSeparator)]
#[case("a\\b", WorkspaceNameRejection::ContainsPathSeparator)]
#[case("images", WorkspaceNameRejection::Reserved)]
#[case(".hidden", WorkspaceNameRejection::Reserved)]
#[case("Work", WorkspaceNameRejection::AlreadyUsed)]
#[case("blog", WorkspaceNameRejection::AlreadyUsed)]
fn rejects_a_name_and_renames_nothing(#[case] typed: &str, #[case] reason: WorkspaceNameRejection) {
    let vault = Vault::create();
    vault.folder("Blog").folder("Work");

    let outcome = vault.rename("Blog", typed);

    assert_eq!(outcome, RenameWorkspaceOutcome::Rejected { reason });
    assert_eq!(vault.folder_names(), ["Blog", "Work"]);
}

#[test]
fn renaming_a_workspace_that_is_gone_is_an_error() {
    let vault = Vault::create();

    let renamed = RenameWorkspace::new(&vault.workspaces()).execute(&name("Gone"), "Writing");

    assert!(matches!(
        renamed,
        Err(WorkspaceRepositoryError::NotRenamed { .. })
    ));
}

#[test]
fn sends_the_rename_outcome_in_camel_case() {
    assert_eq!(
        serde_json::to_value(RenameWorkspaceOutcome::Renamed {
            workspace: "Writing".to_owned()
        })
        .expect("serializable"),
        json!({ "outcome": "renamed", "workspace": "Writing" })
    );
    assert_eq!(
        serde_json::to_value(RenameWorkspaceOutcome::Rejected {
            reason: WorkspaceNameRejection::AlreadyUsed
        })
        .expect("serializable"),
        json!({ "outcome": "rejected", "reason": "alreadyUsed" })
    );
}
