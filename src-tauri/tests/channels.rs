use rustle_domain::VaultScope;
use rustle_lib::channel::Channel;
use rustle_lib::channel_registry::ChannelRegistry;
use rustle_lib::channels::channel_handlers;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};

fn app() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let vault = VaultScope::new(std::env::temp_dir().join("rustle-channels-test-vault"));
    let app = rustle_lib::configure(mock_builder(), vault)
        .build(mock_context(noop_assets()))
        .expect("mock app");
    let window = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .expect("mock window");
    (app, window)
}

fn call(window: &WebviewWindow<MockRuntime>, command_name: &str) -> Result<Value, Value> {
    tauri::test::get_ipc_response(
        window,
        InvokeRequest {
            cmd: command_name.into(),
            callback: CallbackFn(0),
            error: CallbackFn(1),
            url: "tauri://localhost".parse().expect("valid url"),
            body: InvokeBody::default(),
            headers: Default::default(),
            invoke_key: INVOKE_KEY.to_owned(),
        },
    )
    .map(|body| body.deserialize::<Value>().expect("JSON response"))
}

#[test]
fn the_registration_list_covers_every_channel_exactly_once() {
    assert!(ChannelRegistry::new(channel_handlers::<MockRuntime>()).is_ok());
}

#[test]
fn a_name_that_is_not_a_channel_is_rejected_as_unknown() {
    let (_app, window) = app();

    let failure = call(&window, "format_disk").expect_err("unknown channel");

    assert_eq!(failure["reason"], json!("unknownChannel"));
    assert!(
        failure["message"]
            .as_str()
            .expect("message is text")
            .contains("format_disk")
    );
}

#[test]
fn the_webview_channel_list_matches_the_backend_channels() {
    let webview_channels = include_str!("../../src/ipc/channels.ts");
    let mut called_command_names: Vec<&str> = webview_channels
        .split("callChannel")
        .skip(1)
        .filter(|call| call.starts_with(['<', '(']))
        .filter_map(|call| call.split('"').nth(1))
        .collect();

    let mut expected: Vec<&str> = Channel::ALL
        .iter()
        .map(|channel| channel.command_name())
        .collect();
    expected.sort_unstable();
    called_command_names.sort_unstable();
    assert_eq!(called_command_names, expected);

    for channel in Channel::ALL {
        assert!(
            webview_channels.contains(&format!("{}:", channel.name())),
            "{channel} is not exposed to the webview"
        );
    }
}

#[test]
fn answers_the_system_preferred_locales() {
    let (_app, window) = app();

    let answer = call(&window, "read_preferred_locales").expect("answered");

    assert!(answer["locales"].is_array(), "{answer}");
}
