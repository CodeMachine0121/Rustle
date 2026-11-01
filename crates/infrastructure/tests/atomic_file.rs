use std::fs;
use std::path::Path;

use rustle_infrastructure::write_atomically;
use tempfile::TempDir;

#[test]
fn replaces_the_whole_file_content() {
    let directory = TempDir::new().expect("temporary directory");
    let path = directory.path().join("article.md");
    fs::write(&path, "old body that is longer").expect("existing file");

    write_atomically(&path, b"new body").expect("written");

    assert_eq!(fs::read_to_string(&path).expect("readable"), "new body");
}

#[test]
fn refuses_a_path_without_a_folder() {
    assert!(write_atomically(Path::new("/"), b"anything").is_err());
}

#[cfg(unix)]
#[test]
fn keeps_the_permissions_of_the_file_it_replaces() {
    use std::os::unix::fs::PermissionsExt;

    let directory = TempDir::new().expect("temporary directory");
    let path = directory.path().join("article.md");
    fs::write(&path, "old body").expect("existing file");
    fs::set_permissions(&path, fs::Permissions::from_mode(0o644)).expect("permissions");

    write_atomically(&path, b"new body").expect("written");

    let mode = fs::metadata(&path).expect("metadata").permissions().mode();
    assert_eq!(mode & 0o777, 0o644);
}

#[test]
fn creates_a_file_that_did_not_exist() {
    let directory = TempDir::new().expect("temporary directory");
    let path = directory.path().join("new.md");

    write_atomically(&path, b"first body").expect("written");

    assert_eq!(fs::read_to_string(&path).expect("readable"), "first body");
}
