use std::fs;
use std::path::PathBuf;

use rustle_domain::{
    VaultEntry, VaultEntryKind, VaultScope, WorkspaceName, WorkspaceRepository,
    WorkspaceRepositoryError,
};
use rustle_infrastructure::{FileSystemWorkspaceRepository, ResolvedVaultScope};
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

    fn folder(&self, relative_path: &str) -> PathBuf {
        let path = self.root.join(relative_path);
        fs::create_dir_all(&path).expect("folder");
        path
    }

    fn file(&self, relative_path: &str) -> PathBuf {
        let path = self.root.join(relative_path);
        fs::write(&path, "text").expect("file");
        path
    }

    fn outside(&self) -> PathBuf {
        let outside = self.directory.path().join("outside");
        fs::create_dir_all(&outside).expect("folder outside the vault");
        outside
    }

    fn workspaces(&self) -> FileSystemWorkspaceRepository {
        FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(
            &self.root,
        )))
    }
}

fn workspace(name: &str) -> WorkspaceName {
    WorkspaceName::parse(name).expect("valid workspace name")
}

fn sorted(mut entries: Vec<VaultEntry>) -> Vec<VaultEntry> {
    entries.sort_by(|left, right| left.name().cmp(right.name()));
    entries
}

#[test]
fn lists_every_entry_of_the_vault_with_its_kind() {
    let vault = Vault::create();
    vault.folder("Blog");
    vault.folder(".git");
    vault.file("README.txt");

    let entries = vault.workspaces().vault_entries().expect("listed");

    assert_eq!(
        sorted(entries),
        vec![
            VaultEntry::new(".git", VaultEntryKind::Folder),
            VaultEntry::new("Blog", VaultEntryKind::Folder),
            VaultEntry::new("README.txt", VaultEntryKind::File),
        ]
    );
}

#[test]
fn a_vault_that_does_not_exist_has_no_entries() {
    let directory = TempDir::new().expect("temporary directory");
    let workspaces = FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(
        VaultScope::new(directory.path().join("Missing")),
    ));

    assert_eq!(workspaces.vault_entries(), Ok(Vec::new()));
}

#[test]
fn lists_only_the_first_level_of_a_workspace() {
    let vault = Vault::create();
    vault.folder("Blog/2026");
    vault.file("Blog/2026/nested.md");
    vault.file("Blog/top.md");

    let entries = vault
        .workspaces()
        .workspace_entries(&workspace("Blog"))
        .expect("listed");

    assert_eq!(
        sorted(entries),
        vec![
            VaultEntry::new("2026", VaultEntryKind::Folder),
            VaultEntry::new("top.md", VaultEntryKind::File),
        ]
    );
}

#[test]
fn a_workspace_that_disappeared_has_no_entries() {
    let vault = Vault::create();

    assert_eq!(
        vault.workspaces().workspace_entries(&workspace("Gone")),
        Ok(Vec::new())
    );
}

#[test]
fn listing_leaves_the_files_alone() {
    let vault = Vault::create();
    vault.folder("Blog");
    let readme = vault.file("Blog/README.txt");
    let store = vault.file("Blog/.DS_Store");

    vault
        .workspaces()
        .workspace_entries(&workspace("Blog"))
        .expect("listed");

    assert_eq!(fs::read_to_string(readme).expect("still there"), "text");
    assert_eq!(fs::read_to_string(store).expect("still there"), "text");
}

#[cfg(unix)]
#[test]
fn a_link_counts_as_what_it_points_to_inside_the_vault() {
    use std::os::unix::fs::symlink;

    let vault = Vault::create();
    let inside_folder = vault.folder("Real");
    let inside_file = vault.file("real.txt");
    let outside = vault.outside();
    let outside_file = outside.join("secret.txt");
    fs::write(&outside_file, "secret").expect("file outside");
    symlink(&inside_folder, vault.root.join("LinkedFolder")).expect("symlink");
    symlink(&inside_file, vault.root.join("LinkedFile")).expect("symlink");
    symlink(&outside, vault.root.join("EscapingFolder")).expect("symlink");
    symlink(&outside_file, vault.root.join("EscapingFile")).expect("symlink");
    symlink(vault.root.join("nowhere"), vault.root.join("Dangling")).expect("symlink");

    let entries = vault.workspaces().vault_entries().expect("listed");

    assert_eq!(
        sorted(entries),
        vec![
            VaultEntry::new("Dangling", VaultEntryKind::Unreachable),
            VaultEntry::new("EscapingFile", VaultEntryKind::Unreachable),
            VaultEntry::new("EscapingFolder", VaultEntryKind::Unreachable),
            VaultEntry::new("LinkedFile", VaultEntryKind::File),
            VaultEntry::new("LinkedFolder", VaultEntryKind::Folder),
            VaultEntry::new("Real", VaultEntryKind::Folder),
            VaultEntry::new("real.txt", VaultEntryKind::File),
        ]
    );
}

#[cfg(unix)]
#[test]
fn an_article_link_counts_as_what_it_points_to_inside_the_vault() {
    use std::os::unix::fs::symlink;

    let vault = Vault::create();
    vault.folder("Blog");
    let inside = vault.file("Blog/real.md");
    let outside = vault.outside().join("secret.md");
    fs::write(&outside, "secret").expect("file outside");
    symlink(&inside, vault.root.join("Blog/link-inside.md")).expect("symlink");
    symlink(&outside, vault.root.join("Blog/link-outside.md")).expect("symlink");

    let entries = vault
        .workspaces()
        .workspace_entries(&workspace("Blog"))
        .expect("listed");

    assert_eq!(
        sorted(entries),
        vec![
            VaultEntry::new("link-inside.md", VaultEntryKind::File),
            VaultEntry::new("link-outside.md", VaultEntryKind::Unreachable),
            VaultEntry::new("real.md", VaultEntryKind::File),
        ]
    );
}

#[cfg(unix)]
#[test]
fn refuses_to_list_a_workspace_that_links_outside_the_vault() {
    let vault = Vault::create();
    std::os::unix::fs::symlink(vault.outside(), vault.root.join("Escaped")).expect("symlink");

    assert!(matches!(
        vault.workspaces().workspace_entries(&workspace("Escaped")),
        Err(WorkspaceRepositoryError::OutsideVault(_))
    ));
}

#[test]
fn creates_an_empty_workspace_folder() {
    let vault = Vault::create();

    vault
        .workspaces()
        .create(&workspace("Notes"))
        .expect("created");

    assert!(vault.root.join("Notes").is_dir());
    assert_eq!(
        vault.workspaces().workspace_entries(&workspace("Notes")),
        Ok(Vec::new())
    );
}

#[test]
fn creates_the_vault_with_its_first_workspace() {
    let directory = TempDir::new().expect("temporary directory");
    let root = directory.path().join("Rustle");
    let workspaces =
        FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(&root)));

    workspaces.create(&workspace("Notes")).expect("created");

    assert!(root.join("Notes").is_dir());
}

#[test]
fn never_takes_over_a_folder_that_already_exists() {
    let vault = Vault::create();
    vault.folder("Notes");
    vault.file("Notes/kept.md");

    assert!(matches!(
        vault.workspaces().create(&workspace("Notes")),
        Err(WorkspaceRepositoryError::Unwritable { .. })
    ));
    assert!(vault.root.join("Notes/kept.md").is_file());
}

#[test]
fn reports_a_vault_that_cannot_hold_folders() {
    let directory = TempDir::new().expect("temporary directory");
    let root = directory.path().join("Rustle");
    fs::write(&root, "a file where the vault should be").expect("blocking file");
    let workspaces =
        FileSystemWorkspaceRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(&root)));

    assert!(matches!(
        workspaces.create(&workspace("Notes")),
        Err(WorkspaceRepositoryError::Unwritable { .. })
    ));
    assert!(matches!(
        workspaces.vault_entries(),
        Err(WorkspaceRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn a_folder_named_only_with_spaces_cannot_be_reached() {
    let vault = Vault::create();
    vault.folder("   ");

    assert_eq!(
        vault.workspaces().vault_entries(),
        Ok(vec![VaultEntry::new("   ", VaultEntryKind::Unreachable)])
    );
}

#[test]
fn lists_the_images_folder_of_a_workspace() {
    let vault = Vault::create();
    vault.folder("Blog/images/2026");
    vault.file("Blog/images/1.png");

    let entries = vault
        .workspaces()
        .image_entries(&workspace("Blog"))
        .expect("listed");

    assert_eq!(
        sorted(entries),
        vec![
            VaultEntry::new("1.png", VaultEntryKind::File),
            VaultEntry::new("2026", VaultEntryKind::Folder),
        ]
    );
}

#[test]
fn a_workspace_without_an_images_folder_has_no_image_entries() {
    let vault = Vault::create();
    vault.folder("Blog");

    assert_eq!(
        vault.workspaces().image_entries(&workspace("Blog")),
        Ok(Vec::new())
    );
}

#[test]
fn never_renames_onto_an_existing_entry() {
    let vault = Vault::create();
    vault.folder("Blog");
    vault.folder("Work");

    let refused = vault
        .workspaces()
        .rename(&workspace("Blog"), &workspace("Work"));

    assert!(matches!(
        refused,
        Err(WorkspaceRepositoryError::NotRenamed { .. })
    ));
    assert!(vault.root.join("Blog").is_dir());
}

#[cfg(unix)]
#[test]
fn renaming_a_linked_workspace_renames_only_the_link() {
    use std::os::unix::fs::symlink;

    let vault = Vault::create();
    let real = vault.folder("Blog");
    fs::write(real.join("a.md"), "# A").expect("article");
    symlink(&real, vault.root.join("Alias")).expect("symlink");

    vault
        .workspaces()
        .rename(&workspace("Alias"), &workspace("Writing"))
        .expect("renamed");

    assert!(!vault.root.join("Alias").exists());
    assert!(
        fs::symlink_metadata(vault.root.join("Writing"))
            .expect("link under the new name")
            .file_type()
            .is_symlink()
    );
    assert_eq!(
        fs::read_to_string(real.join("a.md")).expect("target untouched"),
        "# A"
    );
}
