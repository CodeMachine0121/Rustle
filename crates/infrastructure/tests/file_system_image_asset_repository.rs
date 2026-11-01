use std::fs;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};

use rustle_domain::{
    ImageAssetRepository, ImageAssetRepositoryError, ImageFileName, VaultPathError, VaultScope,
    WorkspaceName,
};
use rustle_infrastructure::{FileSystemImageAssetRepository, ResolvedVaultScope};
use tempfile::TempDir;

struct Vault {
    directory: TempDir,
    root: PathBuf,
    images: FileSystemImageAssetRepository,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        let images = FileSystemImageAssetRepository::in_vault(ResolvedVaultScope::new(
            VaultScope::new(&root),
        ));
        Self {
            directory,
            root,
            images,
        }
    }

    fn outside(&self) -> PathBuf {
        let outside = self.directory.path().join("outside");
        fs::create_dir_all(&outside).expect("folder outside the vault");
        outside
    }

    fn file(&self, relative_path: &str, contents: &str) {
        let path = self.root.join(relative_path);
        fs::create_dir_all(path.parent().expect("has a folder")).expect("folder");
        fs::write(path, contents).expect("file written");
    }

    fn create_image(&self, workspace: &str, image: &str) -> Result<(), ImageAssetRepositoryError> {
        self.images
            .create(&name(workspace), &image_name(image), b"pixels")
    }

    fn read_image(
        &self,
        workspace: &str,
        image: &str,
    ) -> Result<Vec<u8>, ImageAssetRepositoryError> {
        self.images.read(&name(workspace), &image_name(image))
    }
}

fn name(workspace: &str) -> WorkspaceName {
    WorkspaceName::parse(workspace).expect("valid workspace")
}

fn image_name(image: &str) -> ImageFileName {
    ImageFileName::parse(image).expect("valid image name")
}

fn entries(folder: &Path) -> usize {
    fs::read_dir(folder).expect("listable").count()
}

fn is_outside_vault(result: Result<impl std::fmt::Debug, ImageAssetRepositoryError>) -> bool {
    matches!(
        result,
        Err(ImageAssetRepositoryError::OutsideVault(
            VaultPathError::OutsideVault { .. }
        ))
    )
}

#[test]
fn creates_the_images_folder_and_the_image() {
    let vault = Vault::create();

    vault.create_image("Blog", "x.png").expect("created");

    assert_eq!(
        fs::read(vault.root.join("Blog/images/x.png")).expect("on disk"),
        b"pixels"
    );
}

#[test]
fn never_replaces_an_existing_image() {
    let vault = Vault::create();
    vault.file("Blog/images/x.png", "older");

    let result = vault.create_image("Blog", "x.png");

    assert_eq!(
        result,
        Err(ImageAssetRepositoryError::AlreadyExists {
            image: "Blog/images/x.png".to_owned()
        })
    );
    assert_eq!(
        fs::read_to_string(vault.root.join("Blog/images/x.png")).expect("on disk"),
        "older"
    );
}

#[test]
fn refuses_a_workspace_that_links_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside();
    symlink(&outside, vault.root.join("Mirror")).expect("link");

    assert!(is_outside_vault(vault.create_image("Mirror", "x.png")));
    assert_eq!(entries(&outside), 0);
}

#[test]
fn refuses_an_images_folder_that_links_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside();
    symlink(&outside, vault.root.join("Blog/images")).expect("link");

    assert!(is_outside_vault(vault.create_image("Blog", "x.png")));
    assert_eq!(entries(&outside), 0);
}

#[test]
fn follows_a_workspace_that_links_inside_the_vault() {
    let vault = Vault::create();
    symlink(vault.root.join("Blog"), vault.root.join("Mirror")).expect("link");

    vault.create_image("Mirror", "x.png").expect("created");

    assert!(vault.root.join("Blog/images/x.png").is_file());
}

#[test]
fn a_missing_workspace_cannot_receive_images() {
    let vault = Vault::create();

    let result = vault.create_image("Nowhere", "x.png");

    assert!(matches!(
        result,
        Err(ImageAssetRepositoryError::Unwritable { .. })
    ));
    assert!(!vault.root.join("Nowhere").exists());
}

#[test]
fn an_unwritable_images_folder_fails_without_leaving_a_file() {
    use std::os::unix::fs::PermissionsExt;
    let vault = Vault::create();
    let images = vault.root.join("Blog/images");
    fs::create_dir(&images).expect("images folder");
    fs::set_permissions(&images, fs::Permissions::from_mode(0o500)).expect("read only");

    let result = vault.create_image("Blog", "x.png");

    fs::set_permissions(&images, fs::Permissions::from_mode(0o700)).expect("writable again");
    let error = result.expect_err("refused");
    assert!(matches!(
        error,
        ImageAssetRepositoryError::Unwritable { .. }
    ));
    assert!(error.to_string().contains("Blog/images/x.png"));
    assert!(!error.to_string().contains(&*vault.root.to_string_lossy()));
    assert_eq!(entries(&images), 0);
}

#[test]
fn reads_an_image_back() {
    let vault = Vault::create();
    vault.file("Blog/images/x.png", "pixels");

    assert_eq!(vault.read_image("Blog", "x.png").expect("read"), b"pixels");
}

#[test]
fn a_missing_image_is_not_found_and_named_without_its_location() {
    let vault = Vault::create();

    let error = vault
        .read_image("Blog", "nothing.png")
        .expect_err("missing");

    assert_eq!(
        error,
        ImageAssetRepositoryError::NotFound {
            image: "Blog/images/nothing.png".to_owned()
        }
    );
}

#[test]
fn a_folder_with_an_image_name_is_unreadable() {
    let vault = Vault::create();
    fs::create_dir_all(vault.root.join("Blog/images/folder.png")).expect("folder");

    assert!(matches!(
        vault.read_image("Blog", "folder.png"),
        Err(ImageAssetRepositoryError::Unreadable { .. })
    ));
}

#[test]
fn refuses_to_read_through_an_images_folder_that_links_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.outside();
    fs::write(outside.join("x.png"), "secret").expect("outside image");
    symlink(&outside, vault.root.join("Blog/images")).expect("link");

    assert!(is_outside_vault(vault.read_image("Blog", "x.png")));
}

#[test]
fn reads_through_an_images_folder_that_links_inside_the_vault() {
    let vault = Vault::create();
    vault.file("Shared/x.png", "shared pixels");
    symlink(vault.root.join("Shared"), vault.root.join("Blog/images")).expect("link");

    assert_eq!(
        vault.read_image("Blog", "x.png").expect("read"),
        b"shared pixels"
    );
}
