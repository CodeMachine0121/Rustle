use rustle_domain::VaultScope;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};

fn app() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let vault = VaultScope::new(std::env::temp_dir().join("rustle-window-close-test-vault"));
    let app = rustle_lib::configure(mock_builder(), vault)
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let window = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock window");
    (app, window)
}

fn call(
    window: &WebviewWindow<MockRuntime>,
    command_name: &str,
    arguments: Value,
) -> Result<Value, Value> {
    tauri::test::get_ipc_response(
        window,
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

#[test]
fn accepts_a_channel_to_report_close_requests_on() {
    let (_app, window) = app();

    let watching = call(
        &window,
        "watch_close_requests",
        json!({ "onCloseRequest": "__CHANNEL__:7" }),
    );

    assert_eq!(watching, Ok(Value::Null));
}

#[test]
fn closes_the_window_when_the_webview_answers_close() {
    let (_app, window) = app();

    let answer = call(&window, "answer_close_request", json!({ "close": true }));

    assert_eq!(answer, Ok(Value::Null));
}

#[test]
fn keeps_the_window_open_when_the_webview_answers_stay() {
    let (_app, window) = app();

    let answer = call(&window, "answer_close_request", json!({ "close": false }));

    assert_eq!(answer, Ok(Value::Null));
}
