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
