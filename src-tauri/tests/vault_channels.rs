use std::fs;
use std::path::PathBuf;

use rustle_domain::VaultScope;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};
use tempfile::TempDir;

struct RunningApp {
    vault_directory: TempDir,
    vault_root: PathBuf,
    _app: App<MockRuntime>,
    window: WebviewWindow<MockRuntime>,
}

impl RunningApp {
    fn start() -> Self {
        let vault_directory = TempDir::new().expect("temporary directory");
        let vault_root = vault_directory.path().join("Rustle");
        fs::create_dir_all(&vault_root).expect("vault root");
        let app = rustle_lib::configure(mock_builder(), VaultScope::new(&vault_root))
            .build(mock_context(noop_assets()))
            .expect("mock app");
        let window = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("mock window");
        Self {
            vault_directory,
            vault_root,
            _app: app,
            window,
        }
    }

    fn write(&self, relative_path: &str, text: &str) {
        let path = self.vault_root.join(relative_path);
        if let Some(folder) = path.parent() {
            fs::create_dir_all(folder).expect("folder");
        }
        fs::write(path, text).expect("file written");
    }

    fn call(&self, command_name: &str, arguments: Value) -> Result<Value, Value> {
        tauri::test::get_ipc_response(
            &self.window,
            InvokeRequest {
                cmd: command_name.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().expect("valid url"),
                body: InvokeBody::Json(arguments),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_owned(),
            },
        )
        .map(|body| body.deserialize::<Value>().expect("JSON response"))
    }
}

#[test]
fn lists_the_workspaces_with_their_article_counts() {
    let app = RunningApp::start();
    app.write("Blog/zen-of-writing.md", "---\ntitle: Zen\n---\n");
    app.write("Blog/README.txt", "read me");
    app.write(".rustle/settings.json", "{}");
    fs::create_dir_all(app.vault_root.join("Work")).expect("empty workspace");

    let payload = app.call("list_workspaces", json!({})).expect("listed");

    assert_eq!(
        payload,
        json!([
            { "name": "Blog", "articleCount": 1 },
            { "name": "Work", "articleCount": 0 }
        ])
    );
}

#[test]
fn lists_the_articles_of_a_workspace_with_their_metadata() {
    let app = RunningApp::start();
    app.write(
        "Blog/tauri.md",
        "---\ntitle: Tauri 與 Electron 的取捨\ncreated_at: 2026-08-20T14:32:05+08:00\ncategory: 技術筆記\ntags:\n  - tauri\n---\n",
    );

    let payload = app
        .call("list_articles", json!({ "workspace": "Blog" }))
        .expect("listed");

    assert_eq!(
        payload,
        json!([{
            "fileName": "tauri.md",
            "title": "Tauri 與 Electron 的取捨",
            "createdAt": "2026-08-20T14:32:05+08:00",
            "category": ["技術筆記"],
            "tags": ["tauri"],
            "hasIncompleteMetadata": false
        }])
    );
}

#[test]
fn refuses_to_list_a_workspace_that_escapes_the_vault() {
    let app = RunningApp::start();

    let failure = app
        .call("list_articles", json!({ "workspace": "../../etc" }))
        .expect_err("outside the vault");

    assert_eq!(failure["reason"], json!("outsideVault"));
}

#[test]
fn refuses_a_workspace_name_that_climbs_out_without_listing_what_is_there() {
    let app = RunningApp::start();
    let outside = app.vault_directory.path().join("outside");
    fs::create_dir_all(&outside).expect("folder outside the vault");
    fs::write(outside.join("secret.md"), "---\ntitle: 秘密\n---\n").expect("file outside");

    let failure = app
        .call("list_articles", json!({ "workspace": "../outside" }))
        .expect_err("outside the vault");

    assert_eq!(failure["reason"], json!("outsideVault"));
    assert!(!failure.to_string().contains("秘密"));
}

#[cfg(unix)]
#[test]
fn refuses_to_list_a_workspace_linked_outside_the_vault() {
    let app = RunningApp::start();
    let outside = app.vault_directory.path().join("outside");
    fs::create_dir_all(&outside).expect("folder outside the vault");
    std::os::unix::fs::symlink(&outside, app.vault_root.join("Escaped")).expect("symlink");

    let failure = app
        .call("list_articles", json!({ "workspace": "Escaped" }))
        .expect_err("outside the vault");

    assert_eq!(failure["reason"], json!("outsideVault"));
}

#[test]
fn reports_a_vault_that_cannot_be_listed_as_unexpected() {
    let app = RunningApp::start();
    fs::remove_dir_all(&app.vault_root).expect("vault removed");
    fs::write(&app.vault_root, "a file where the vault should be").expect("blocking file");

    let listed = app
        .call("list_workspaces", json!({}))
        .expect_err("not a folder");
    let created = app
        .call("create_workspace", json!({ "name": "Notes" }))
        .expect_err("not a folder");

    assert_eq!(listed["reason"], json!("unexpected"));
    assert_eq!(created["reason"], json!("unexpected"));
}

#[test]
fn creates_a_workspace_and_answers_a_rejection_as_an_outcome() {
    let app = RunningApp::start();

    let created = app
        .call("create_workspace", json!({ "name": "Notes" }))
        .expect("answered");
    let rejected = app
        .call("create_workspace", json!({ "name": "notes" }))
        .expect("answered");

    assert_eq!(
        created,
        json!({ "outcome": "created", "workspace": { "name": "Notes", "articleCount": 0 } })
    );
    assert_eq!(
        rejected,
        json!({ "outcome": "rejected", "reason": "alreadyUsed" })
    );
    assert!(app.vault_root.join("Notes").is_dir());
}

#[test]
fn writes_settings_that_read_back_and_keeps_keys_it_does_not_know() {
    let app = RunningApp::start();
    app.write(".rustle/settings.json", r#"{ "myOwnNote": "keep me" }"#);
    let settings = json!({
        "indentation": { "style": "tab", "width": 4 },
        "previewPanel": { "isOpen": false, "widthRatio": 0.3 },
        "lastOpened": { "workspace": "Blog", "article": "zen-of-writing.md" }
    });

    app.call("write_settings", json!({ "settings": settings }))
        .expect("written");

    assert_eq!(app.call("read_settings", json!({})), Ok(settings));
    let stored: Value = serde_json::from_str(
        &fs::read_to_string(app.vault_root.join(".rustle/settings.json")).expect("file"),
    )
    .expect("JSON");
    assert_eq!(stored["myOwnNote"], json!("keep me"));
}

#[test]
fn reads_default_settings_from_a_broken_file() {
    let app = RunningApp::start();
    app.write(".rustle/settings.json", "{ 這不是 json");

    let settings = app.call("read_settings", json!({})).expect("defaults");

    assert_eq!(
        settings["lastOpened"],
        json!({ "workspace": null, "article": null })
    );
}

#[cfg(unix)]
#[test]
fn refuses_settings_kept_outside_the_vault() {
    let app = RunningApp::start();
    let outside = app.vault_directory.path().join("outside");
    fs::create_dir_all(&outside).expect("folder outside the vault");
    std::os::unix::fs::symlink(&outside, app.vault_root.join(".rustle")).expect("symlink");

    let read = app
        .call("read_settings", json!({}))
        .expect_err("outside the vault");
    let written = app
        .call(
            "write_settings",
            json!({ "settings": { "indentation": { "style": "spaces", "width": 2 } } }),
        )
        .expect_err("outside the vault");

    assert_eq!(read["reason"], json!("outsideVault"));
    assert_eq!(written["reason"], json!("outsideVault"));
}
