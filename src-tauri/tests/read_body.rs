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
    _vault_directory: TempDir,
    vault_root: PathBuf,
    _app: App<MockRuntime>,
    window: WebviewWindow<MockRuntime>,
}

impl RunningApp {
    fn start() -> Self {
        let vault_directory = TempDir::new().expect("temporary directory");
        let vault_root = vault_directory.path().join("Rustle");
        fs::create_dir_all(vault_root.join("Blog")).expect("workspace folder");
        let app = rustle_lib::configure(mock_builder(), VaultScope::new(&vault_root))
            .build(mock_context(noop_assets()))
            .expect("mock app");
        let window = WebviewWindowBuilder::new(&app, "main", Default::default())
            .build()
            .expect("mock window");
        Self {
            _vault_directory: vault_directory,
            vault_root,
            _app: app,
            window,
        }
    }

    fn write_article(&self, file_name: &str, text: &str) {
        fs::write(self.vault_root.join("Blog").join(file_name), text).expect("article written");
    }

    fn read_body(&self, workspace: &str, file_name: &str) -> Result<Value, Value> {
        tauri::test::get_ipc_response(
            &self.window,
            InvokeRequest {
                cmd: "read_body".into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().expect("valid url"),
                body: InvokeBody::Json(json!({ "workspace": workspace, "fileName": file_name })),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_owned(),
            },
        )
        .map(|body| body.deserialize::<Value>().expect("JSON response"))
    }
}

#[test]
fn answers_with_the_body_the_article_asked_for_and_its_modification_time() {
    let app = RunningApp::start();
    app.write_article(
        "zen-of-writing.md",
        "---\ntitle: Zen of Writing\ncategory:\n  - 技術筆記\n---\n\n正文的第一行。\n",
    );

    let payload = app
        .read_body("Blog", "zen-of-writing.md")
        .expect("article read");

    assert_eq!(payload["body"], json!("\n正文的第一行。\n"));
    assert_eq!(payload["workspace"], json!("Blog"));
    assert_eq!(payload["fileName"], json!("zen-of-writing.md"));
    let modified_at = payload["lastKnownModifiedAt"]
        .as_str()
        .expect("modification time is text");
    assert!(modified_at.ends_with('Z'), "{modified_at}");
}

#[test]
fn answers_with_the_whole_file_when_there_is_no_front_matter() {
    let app = RunningApp::start();
    app.write_article("plain.md", "# 只有正文\n\n第二段。\n");

    let payload = app.read_body("Blog", "plain.md").expect("article read");

    assert_eq!(payload["body"], json!("# 只有正文\n\n第二段。\n"));
}

#[test]
fn refuses_a_name_that_escapes_the_vault() {
    let app = RunningApp::start();

    let failure = app
        .read_body("Blog", "../../etc/passwd")
        .expect_err("outside the vault");

    assert_eq!(failure["reason"], json!("outsideVault"));
}

#[test]
fn reports_a_missing_article_as_unexpected() {
    let app = RunningApp::start();

    let failure = app.read_body("Blog", "missing.md").expect_err("missing");

    assert_eq!(failure["reason"], json!("unexpected"));
}
