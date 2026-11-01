use std::fs;
use std::path::Path;

use rustle_domain::{ArticleFileName, ImageFileName, VaultPathError, VaultScope, WorkspaceName};
use rustle_infrastructure::ResolvedVaultScope;
use tempfile::TempDir;

struct Vault {
    _directory: TempDir,
    root: std::path::PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = fs::canonicalize(directory.path())
            .expect("canonical temp dir")
            .join("Rustle");
        fs::create_dir_all(&root).expect("vault root");
        Self {
            _directory: directory,
            root,
        }
    }

    fn scope(&self) -> ResolvedVaultScope {
        ResolvedVaultScope::new(VaultScope::new(&self.root))
    }
}

fn workspace(name: &str) -> WorkspaceName {
    WorkspaceName::parse(name).expect("valid workspace name")
}

fn article(name: &str) -> ArticleFileName {
    ArticleFileName::parse(name).expect("valid article name")
}

#[test]
fn locates_an_existing_article_at_its_real_location() {
    let vault = Vault::create();
    fs::create_dir_all(vault.root.join("Blog")).expect("workspace");
    fs::write(vault.root.join("Blog/zen-of-writing.md"), "# Zen").expect("article");

    let path = vault
        .scope()
        .article_path(&workspace("Blog"), &article("zen-of-writing.md"));

    assert_eq!(path, Ok(vault.root.join("Blog/zen-of-writing.md")));
}

#[test]
fn locates_an_article_whose_workspace_does_not_exist_yet() {
    let vault = Vault::create();

    let path = vault
        .scope()
        .article_path(&workspace("Blog"), &article("not-created-yet.md"));

    assert_eq!(path, Ok(vault.root.join("Blog/not-created-yet.md")));
}

#[test]
fn locates_an_image_inside_the_images_folder() {
    let vault = Vault::create();
    let image = ImageFileName::parse("cover.png").expect("valid image name");

    let path = vault.scope().image_path(&workspace("Blog"), &image);

    assert_eq!(path, Ok(vault.root.join("Blog/images/cover.png")));
}

#[test]
fn locates_the_settings_file_inside_the_vault() {
    let vault = Vault::create();

    assert_eq!(
        vault.scope().settings_file_path(),
        Ok(vault.root.join(".rustle/settings.json"))
    );
}

#[test]
fn locates_a_workspace_when_the_vault_root_does_not_exist_yet() {
    let vault = Vault::create();
    let missing_root = vault.root.join("not-yet");
    let scope = ResolvedVaultScope::new(VaultScope::new(&missing_root));

    assert_eq!(
        scope.workspace_path(&workspace("Blog")),
        Ok(missing_root.join("Blog"))
    );
}

#[cfg(unix)]
mod symlinks {
    use super::*;
    use std::os::unix::fs::symlink;

    fn outside_folder(vault: &Vault) -> std::path::PathBuf {
        let outside = vault
            .root
            .parent()
            .map(Path::to_path_buf)
            .expect("parent")
            .join("outside");
        fs::create_dir_all(&outside).expect("outside folder");
        outside
    }

    #[test]
    fn rejects_a_workspace_that_links_outside_the_vault() {
        let vault = Vault::create();
        symlink(outside_folder(&vault), vault.root.join("Escape")).expect("symlink");

        assert_eq!(
            vault.scope().workspace_path(&workspace("Escape")),
            Err(VaultPathError::OutsideVault {
                rejected: "Escape".to_owned()
            })
        );
    }

    #[test]
    fn rejects_an_article_that_links_outside_the_vault() {
        let vault = Vault::create();
        let outside = outside_folder(&vault);
        fs::write(outside.join("secret.md"), "secret").expect("outside file");
        fs::create_dir_all(vault.root.join("Blog")).expect("workspace");
        symlink(outside.join("secret.md"), vault.root.join("Blog/linked.md")).expect("symlink");

        let path = vault
            .scope()
            .article_path(&workspace("Blog"), &article("linked.md"));

        assert_eq!(
            path,
            Err(VaultPathError::OutsideVault {
                rejected: "Blog/linked.md".to_owned()
            })
        );
    }

    #[test]
    fn rejects_a_new_article_inside_a_workspace_that_links_outside_the_vault() {
        let vault = Vault::create();
        symlink(outside_folder(&vault), vault.root.join("Escape")).expect("symlink");

        let path = vault
            .scope()
            .article_path(&workspace("Escape"), &article("new.md"));

        assert!(path.is_err());
    }

    #[test]
    fn accepts_a_link_that_stays_inside_the_vault() {
        let vault = Vault::create();
        fs::create_dir_all(vault.root.join("Blog")).expect("workspace");
        symlink(vault.root.join("Blog"), vault.root.join("Alias")).expect("symlink");

        assert_eq!(
            vault.scope().workspace_path(&workspace("Alias")),
            Ok(vault.root.join("Blog"))
        );
    }

    #[test]
    fn accepts_a_vault_root_that_is_itself_a_link() {
        let vault = Vault::create();
        let linked_root = vault.root.parent().expect("parent").join("LinkedRustle");
        symlink(&vault.root, &linked_root).expect("symlink");
        let scope = ResolvedVaultScope::new(VaultScope::new(&linked_root));

        assert_eq!(
            scope.workspace_path(&workspace("Blog")),
            Ok(vault.root.join("Blog"))
        );
    }
}
