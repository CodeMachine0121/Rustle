use serde_json::{Value, json};

fn json_file(contents: &str) -> Value {
    serde_json::from_str(contents).expect("valid JSON")
}

#[test]
fn the_webview_gets_no_permissions_beyond_rustle_channels() {
    let capability = json_file(include_str!("../capabilities/main-window.json"));

    assert_eq!(capability["windows"], json!(["main"]));
    assert_eq!(capability["permissions"], json!([]));
}

#[test]
fn the_app_uses_only_the_locked_down_capability_and_no_global_api() {
    let configuration = json_file(include_str!("../tauri.conf.json"));

    assert_eq!(
        configuration["app"]["security"]["capabilities"],
        json!(["main-window"])
    );
    assert_eq!(configuration["app"]["withGlobalTauri"], json!(false));
}

#[test]
fn every_rust_dependency_version_is_pinned() {
    let manifest = include_str!("../../Cargo.toml");
    let dependency_section = manifest
        .split("[workspace.dependencies]")
        .nth(1)
        .and_then(|rest| rest.split("\n[").next())
        .expect("workspace dependencies section");

    let unpinned: Vec<&str> = dependency_section
        .lines()
        .filter(|line| line.contains("version") || line.contains("= \""))
        .filter(|line| !line.contains("path ="))
        .filter(|line| !line.contains("\"="))
        .collect();
    assert!(unpinned.is_empty(), "unpinned: {unpinned:?}");
}
