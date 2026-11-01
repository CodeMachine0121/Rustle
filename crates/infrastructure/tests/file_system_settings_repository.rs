use std::fs;
use std::path::PathBuf;

use rustle_domain::{
    IndentationSettings, IndentationStyle, LastOpenedSettings, PreviewPanelSettings, Settings,
    SettingsError, SettingsRepository, SidebarSection, SidebarSettings, VaultScope,
};
use rustle_infrastructure::{FileSystemSettingsRepository, ResolvedVaultScope};
use serde_json::{Value, json};
use tempfile::TempDir;

struct Vault {
    directory: TempDir,
    root: PathBuf,
}

impl Vault {
    fn create() -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        Self { directory, root }
    }

    fn repository(&self) -> FileSystemSettingsRepository {
        FileSystemSettingsRepository::in_vault(ResolvedVaultScope::new(VaultScope::new(&self.root)))
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

    assert_eq!(
        vault.read_settings_file(),
        json!({
            "indentation": { "style": "spaces", "width": 2 },
            "previewPanel": { "isOpen": true, "widthRatio": 0.5 },
            "lastOpened": { "workspace": null, "article": null },
            "sidebar": { "collapsedSections": [] }
        })
    );
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
        vault.read_settings_file()["fromTheFuture"],
        json!({ "enabled": true })
    );
}

#[test]
fn keeps_keys_it_does_not_understand_inside_a_section_when_saving() {
    let vault = Vault::create();
    vault.write_settings_file(
        r#"{ "previewPanel": { "isOpen": true, "widthRatio": 0.5, "fromTheFuture": "kept" } }"#,
    );

    let mut settings = vault.repository().load().expect("readable");
    settings.preview_panel.is_open = false;
    vault.repository().save(&settings).expect("saved");

    assert_eq!(
        vault.read_settings_file()["previewPanel"],
        json!({ "isOpen": false, "widthRatio": 0.5, "fromTheFuture": "kept" })
    );
}

#[test]
fn keeps_an_unusable_toggle_shortcut_when_folding_the_panel() {
    let vault = Vault::create();
    vault.write_settings_file(r#"{ "previewPanel": { "isOpen": true, "toggleShortcut": 42 } }"#);

    let mut settings = vault.repository().load().expect("readable");
    settings.preview_panel.is_open = false;
    vault.repository().save(&settings).expect("saved");

    assert_eq!(
        vault.read_settings_file()["previewPanel"]["toggleShortcut"],
        json!(42)
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

fn remembered_settings() -> Settings {
    Settings {
        indentation: IndentationSettings {
            style: IndentationStyle::Tab,
            width: 4,
        },
        preview_panel: PreviewPanelSettings {
            is_open: false,
            width_ratio: 0.3,
            toggle_shortcut: Some("Mod+Alt+K".to_owned()),
        },
        last_opened: LastOpenedSettings {
            workspace: Some("Blog".to_owned()),
            article: Some("zen-of-writing.md".to_owned()),
        },
        sidebar: SidebarSettings {
            collapsed_sections: vec![SidebarSection::Tags],
        },
    }
}

#[test]
fn reads_back_what_it_wrote() {
    let vault = Vault::create();

    vault
        .repository()
        .save(&remembered_settings())
        .expect("saved");

    assert_eq!(vault.repository().load(), Ok(remembered_settings()));
}

#[test]
fn reads_settings_a_person_wrote_by_hand() {
    let vault = Vault::create();
    vault.write_settings_file(
        r#"{ "indentation": { "style": "spaces", "width": 4 }, "previewPanel": { "isOpen": false }, "lastOpened": { "workspace": "Blog", "article": "zen-of-writing.md" } }"#,
    );

    let settings = vault.repository().load().expect("readable");

    assert_eq!(settings.indentation.width, 4);
    assert!(!settings.preview_panel.is_open);
    assert_eq!(settings.last_opened.workspace.as_deref(), Some("Blog"));
    assert_eq!(
        settings.last_opened.article.as_deref(),
        Some("zen-of-writing.md")
    );
}

#[test]
fn keeps_an_old_vault_path_key_as_an_unknown_key() {
    let vault = Vault::create();
    vault.write_settings_file(r#"{ "vaultPath": "/Users/james/Elsewhere" }"#);

    let settings = vault.repository().load().expect("readable");
    vault.repository().save(&settings).expect("saved");

    assert_eq!(
        vault.read_settings_file()["vaultPath"],
        json!("/Users/james/Elsewhere")
    );
}

#[cfg(unix)]
#[test]
fn refuses_a_settings_folder_that_links_outside_the_vault() {
    let vault = Vault::create();
    let outside = vault.directory.path().join("outside");
    fs::create_dir_all(&outside).expect("folder outside the vault");
    fs::write(outside.join("settings.json"), "{}").expect("settings outside");
    fs::create_dir_all(&vault.root).expect("vault root");
    std::os::unix::fs::symlink(&outside, vault.root.join(".rustle")).expect("symlink");

    assert!(matches!(
        vault.repository().load(),
        Err(SettingsError::OutsideVault(_))
    ));
    assert!(matches!(
        vault.repository().save(&Settings::default()),
        Err(SettingsError::OutsideVault(_))
    ));
    assert_eq!(
        fs::read_to_string(outside.join("settings.json")).expect("untouched"),
        "{}"
    );
}
