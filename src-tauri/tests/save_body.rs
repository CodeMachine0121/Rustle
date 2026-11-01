use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime};

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

    fn article_path(&self) -> PathBuf {
        self.vault_root.join("Blog").join("zen.md")
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

    fn last_known_modified_at(&self) -> String {
        let article = self
            .call(
                "read_body",
                json!({ "workspace": "Blog", "fileName": "zen.md" }),
            )
            .expect("article read");
        article["lastKnownModifiedAt"]
            .as_str()
            .expect("modification time is text")
            .to_owned()
    }

    fn save_body(
        &self,
        file_name: &str,
        body: &str,
        last_known_modified_at: &str,
        overwrite: bool,
    ) -> Result<Value, Value> {
        self.call(
            "save_body",
            json!({
                "workspace": "Blog",
                "fileName": file_name,
                "body": body,
                "lastKnownModifiedAt": last_known_modified_at,
                "overwrite": overwrite,
            }),
        )
    }
}

#[test]
fn answers_with_the_new_updated_at_and_modification_time() {
    let app = RunningApp::start();
    fs::write(app.article_path(), "---\ntitle: Zen\n---\n舊的正文\n").expect("article");
    let loaded_at = app.last_known_modified_at();

    let saved = app
        .save_body("zen.md", "新的正文\n", &loaded_at, false)
        .expect("saved");

    assert_eq!(saved["outcome"], json!("saved"));
    let updated_at = saved["updatedAt"].as_str().expect("updated_at is text");
    assert!(updated_at.ends_with('Z'), "{updated_at}");
    assert_eq!(
        saved["lastKnownModifiedAt"],
        json!(app.last_known_modified_at())
    );
    assert_eq!(
        fs::read_to_string(app.article_path()).expect("readable"),
        format!("---\ntitle: Zen\nupdated_at: {updated_at}\n---\n新的正文\n")
    );
}

#[test]
fn answers_that_the_file_was_modified_elsewhere_and_writes_nothing() {
    let app = RunningApp::start();
    fs::write(app.article_path(), "載入時的正文\n").expect("article");
    let loaded_at = app.last_known_modified_at();
    fs::write(app.article_path(), "別的程式寫的\n").expect("outside edit");
    fs::File::options()
        .write(true)
        .open(app.article_path())
        .and_then(|file| file.set_modified(SystemTime::now() + Duration::from_secs(60)))
        .expect("modification time set");

    let saved = app
        .save_body("zen.md", "Rustle 的正文\n", &loaded_at, false)
        .expect("answered");

    assert_eq!(
        saved,
        json!({ "outcome": "modifiedElsewhere", "lastKnownModifiedAt": loaded_at })
    );
    assert_eq!(
        fs::read_to_string(app.article_path()).expect("readable"),
        "別的程式寫的\n"
    );
}

#[test]
fn overwrites_when_the_user_authorised_it() {
    let app = RunningApp::start();
    fs::write(app.article_path(), "載入時的正文\n").expect("article");

    let saved = app
        .save_body(
            "zen.md",
            "Rustle 的正文\n",
            "1970-01-01T00:00:00.000Z",
            true,
        )
        .expect("saved");

    assert_eq!(saved["outcome"], json!("saved"));
    assert!(
        fs::read_to_string(app.article_path())
            .expect("readable")
            .ends_with("Rustle 的正文\n")
    );
}

#[test]
fn refuses_a_name_that_escapes_the_vault() {
    let app = RunningApp::start();

    let failure = app
        .save_body("../../etc/passwd", "覆寫", "1970-01-01T00:00:00.000Z", true)
        .expect_err("outside the vault");

    assert_eq!(failure["reason"], json!("outsideVault"));
}

#[test]
fn reports_a_missing_article_as_unexpected() {
    let app = RunningApp::start();

    let failure = app
        .save_body("missing.md", "正文", "1970-01-01T00:00:00.000Z", false)
        .expect_err("missing");

    assert_eq!(failure["reason"], json!("unexpected"));
    assert!(!app.vault_root.join("Blog").join("missing.md").exists());
}
