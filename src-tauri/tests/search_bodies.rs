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
        fs::create_dir_all(vault_root.join("日記")).expect("workspace folder");
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
        fs::write(self.vault_root.join("日記").join(file_name), text).expect("article written");
    }

    fn search(&self, text: &str, articles: Value) -> Result<Value, Value> {
        tauri::test::get_ipc_response(
            &self.window,
            InvokeRequest {
                cmd: "search_bodies".into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().expect("valid url"),
                body: InvokeBody::Json(json!({ "text": text, "articles": articles })),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_owned(),
            },
        )
        .map(|body| body.deserialize::<Value>().expect("JSON response"))
    }
}

#[test]
fn answers_with_the_lines_that_hold_the_text() {
    let app = RunningApp::start();
    app.write_article(
        "tired.md",
        "---\ntitle: 今天很累\n---\n第一行\n第二行\n今天加班到很晚\n",
    );

    let payload = app
        .search(
            "加班",
            json!([{ "workspace": "日記", "fileName": "tired.md" }]),
        )
        .expect("searched");

    assert_eq!(
        payload,
        json!({
            "matches": [{
                "workspace": "日記",
                "fileName": "tired.md",
                "lineNumber": 3,
                "lineText": "今天加班到很晚"
            }],
            "isTruncated": false
        })
    );
}

#[test]
fn blank_text_finds_nothing() {
    let app = RunningApp::start();
    app.write_article("tired.md", "   \n");

    let payload = app
        .search(
            "   ",
            json!([{ "workspace": "日記", "fileName": "tired.md" }]),
        )
        .expect("searched");

    assert_eq!(payload, json!({ "matches": [], "isTruncated": false }));
}

#[test]
fn refuses_an_article_named_outside_the_vault() {
    let app = RunningApp::start();

    let error = app
        .search(
            "加班",
            json!([{ "workspace": "..", "fileName": "passwd.md" }]),
        )
        .expect_err("refused");

    assert_eq!(error["reason"], "outsideVault");
}
