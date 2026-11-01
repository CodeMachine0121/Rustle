// The webview reads its policy from tauri.conf.json; this module is the
// readable source of truth that a test pins that file to.
#[cfg(test)]
mod content_security_policy;
pub mod navigation_policy;

use tauri::{App, WebviewUrl, WebviewWindowBuilder};

const MAIN_WINDOW_LABEL: &str = "main";

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            open_main_window(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Rustle failed to start");
}

fn open_main_window(app: &App) -> tauri::Result<()> {
    WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App("index.html".into()))
        .title("Rustle")
        .inner_size(1200.0, 800.0)
        .min_inner_size(640.0, 400.0)
        .build()?;
    Ok(())
}
