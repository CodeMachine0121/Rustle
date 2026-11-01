// The webview reads its policy from tauri.conf.json; this module is the
// readable source of truth that a test pins that file to.
#[cfg(test)]
mod content_security_policy;

pub mod channel;
pub mod channel_registry;
pub mod channels;
pub mod command_error;
pub mod commands;
pub mod navigation_policy;
pub mod protocol_registry;
pub mod protocols;
pub mod vault_asset_scheme;
pub mod window_close_guard;

use rustle_domain::VaultScope;
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use tauri::webview::NewWindowResponse;
use tauri::{App, Builder, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder, WindowEvent};

use crate::channel_registry::ChannelRegistry;
use crate::channels::channel_handlers;
use crate::navigation_policy::{NavigationDecision, NavigationPolicy};
use crate::protocol_registry::ProtocolRegistry;
use crate::protocols::scheme_handlers;
use crate::window_close_guard::{CloseRequestDecision, WindowCloseGuard};

const MAIN_WINDOW_LABEL: &str = "main";
const APP_PAGE: &str = "index.html";

pub fn run() {
    let home = std::env::home_dir().expect("Rustle keeps its vault in the home directory");
    configure(Builder::default(), VaultScope::at_default_location(&home))
        .setup(|app| {
            open_main_window(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Rustle failed to start");
}

/// Installs the vault-backed state and the channel and protocol registries.
/// Assembly mistakes (a channel without a handler, a scheme registered
/// twice) stop the app here.
pub fn configure<R: Runtime>(builder: Builder<R>, vault: VaultScope) -> Builder<R> {
    let channels =
        ChannelRegistry::new(channel_handlers()).expect("every channel has exactly one handler");
    let protocols =
        ProtocolRegistry::new(scheme_handlers()).expect("every scheme has exactly one handler");
    protocols
        .install(builder)
        .manage(FileSystemArticleRepository::in_vault(
            ResolvedVaultScope::new(vault),
        ))
        .manage(WindowCloseGuard::default())
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event
                && window.state::<WindowCloseGuard>().close_requested()
                    == CloseRequestDecision::KeepOpenAndAskWebview
            {
                api.prevent_close();
            }
        })
        .invoke_handler(channels.into_invoke_handler())
}

fn open_main_window<R: Runtime>(app: &App<R>) -> tauri::Result<()> {
    let navigation_policy = NavigationPolicy::new(app_page_url(app));
    let new_window_policy = navigation_policy.clone();
    WebviewWindowBuilder::new(app, MAIN_WINDOW_LABEL, WebviewUrl::App(APP_PAGE.into()))
        .title("Rustle")
        .inner_size(1200.0, 800.0)
        .min_inner_size(640.0, 400.0)
        .on_navigation(
            move |target| match navigation_policy.decide(target.as_str()) {
                NavigationDecision::Allow => true,
                NavigationDecision::Deny { open_in_browser } => {
                    if open_in_browser {
                        open_in_system_browser(target);
                    }
                    false
                }
            },
        )
        .on_new_window(move |target, _features| {
            if let NavigationDecision::Deny {
                open_in_browser: true,
            } = new_window_policy.decide(target.as_str())
            {
                open_in_system_browser(&target);
            }
            NewWindowResponse::Deny
        })
        .build()?;
    Ok(())
}

fn open_in_system_browser(target: &Url) {
    if let Err(error) = tauri_plugin_opener::open_url(target.as_str(), None::<&str>) {
        eprintln!("could not open {target} in the browser: {error}");
    }
}

/// Mirrors how Tauri resolves `WebviewUrl::App`: the dev server while
/// developing, otherwise its asset protocol origin.
fn app_page_url<R: Runtime>(app: &App<R>) -> Url {
    let origin = if cfg!(windows) {
        "http://tauri.localhost/"
    } else {
        "tauri://localhost/"
    };
    let base = tauri::is_dev()
        .then(|| app.config().build.dev_url.clone())
        .flatten()
        .unwrap_or_else(|| Url::parse(origin).expect("the asset origin is a valid URL"));
    base.join(APP_PAGE)
        .expect("the app page name is a valid relative URL")
}
