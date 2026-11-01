use std::fs;
use std::path::PathBuf;

use rustle_domain::{Settings, SettingsError, SettingsRepository, VaultScope};
use rustle_infrastructure::{FileSystemSettingsRepository, ResolvedVaultScope};
use serde_json::{Value, json};
use tempfile::TempDir;

struct Vault {
    _directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        Self {
            _directory: directory,
            root,
        }
    }

    fn repository(&self) -> FileSystemSettingsRepository {
        let scope = ResolvedVaultScope::new(VaultScope::new(&self.root));
        FileSystemSettingsRepository::in_vault(&scope).expect("settings path is inside the vault")
    }

    fn settings_file(&self) -> PathBuf {
        self.root.join(".rustle/settings.json")
    }

    fn write_settings_file(&self, contents: &str) {
        fs::create_dir_all(self.root.join(".rustle")).expect("settings folder");
        fs::write(self.settings_file(), contents).expect("settings file");
    }

    fn read_settings_file(&self) -> Value {
        let text = fs::read_to_string(self.settings_file()).expect("settings file exists");
        serde_json::from_str(&text).expect("settings file is JSON")
    }
}

#[test]
fn loads_defaults_when_no_settings_file_exists() {
    let vault = Vault::create();

    assert_eq!(vault.repository().load(), Ok(Settings::default()));
}

#[test]
fn reports_an_unreadable_settings_file_instead_of_guessing() {
    let vault = Vault::create();
    vault.write_settings_file("{ not json");

    assert!(matches!(
        vault.repository().load(),
        Err(SettingsError::Unreadable(_))
    ));
}

#[test]
fn creates_the_settings_file_inside_the_hidden_rustle_folder() {
    let vault = Vault::create();

    vault
        .repository()
        .save(&Settings::default())
        .expect("saved");

    assert_eq!(vault.read_settings_file(), json!({}));
}

#[test]
fn keeps_keys_it_does_not_understand_when_saving() {
    let vault = Vault::create();
    vault.write_settings_file(r#"{ "fromTheFuture": { "enabled": true } }"#);

    vault
        .repository()
        .save(&Settings::default())
        .expect("saved");

    assert_eq!(
        vault.read_settings_file(),
        json!({ "fromTheFuture": { "enabled": true } })
    );
}

#[test]
fn refuses_to_overwrite_a_settings_file_it_cannot_read() {
    let vault = Vault::create();
    vault.write_settings_file("{ not json");

    let result = vault.repository().save(&Settings::default());

    assert!(matches!(result, Err(SettingsError::Unreadable(_))));
    assert_eq!(
        fs::read_to_string(vault.settings_file()).expect("still there"),
        "{ not json"
    );
}

#[test]
fn leaves_no_temporary_files_behind_after_saving() {
    let vault = Vault::create();

    vault
        .repository()
        .save(&Settings::default())
        .expect("saved");

    let entries: Vec<_> = fs::read_dir(vault.root.join(".rustle"))
        .expect("settings folder")
        .map(|entry| entry.expect("entry").file_name())
        .collect();
    assert_eq!(entries, vec!["settings.json"]);
}

#[test]
fn reports_a_blocked_settings_folder_and_leaves_it_alone() {
    let vault = Vault::create();
    fs::create_dir_all(&vault.root).expect("vault root");
    fs::write(vault.root.join(".rustle"), "not a folder").expect("blocking file");

    let result = vault.repository().save(&Settings::default());

    assert!(result.is_err());
    assert_eq!(
        fs::read_to_string(vault.root.join(".rustle")).expect("still there"),
        "not a folder"
    );
}
