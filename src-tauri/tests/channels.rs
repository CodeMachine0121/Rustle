use rustle_lib::channel::Channel;
use rustle_lib::channel_registry::ChannelRegistry;
use rustle_lib::channels::channel_handlers;
use serde_json::{Value, json};
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{INVOKE_KEY, MockRuntime, mock_builder, mock_context, noop_assets};
use tauri::webview::InvokeRequest;
use tauri::{App, WebviewWindow, WebviewWindowBuilder};

fn app() -> (App<MockRuntime>, WebviewWindow<MockRuntime>) {
    let app = rustle_lib::configure(mock_builder())
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
fn every_channel_not_yet_implemented_says_so_and_names_itself() {
    let (_app, window) = app();

    for channel in Channel::ALL {
        let failure = call(&window, channel.command_name()).expect_err("not implemented yet");

        assert_eq!(failure["reason"], json!("notImplemented"), "{channel}");
        let message = failure["message"].as_str().expect("message is text");
        assert!(message.contains(channel.name()), "{message}");
    }
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
