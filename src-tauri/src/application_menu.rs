use tauri::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
use tauri::{AppHandle, Manager, Runtime};

use crate::MAIN_WINDOW_LABEL;

pub const CLOSE_WINDOW_MENU_ID: &str = "close-window";
pub const CLOSE_WINDOW_ACCELERATOR: &str = "Shift+CmdOrCtrl+W";

/// The stock menu with every Close Window row rebound to Shift+Cmd+W in its
/// own place, so Cmd+W belongs to the writing surface. Every other row is
/// the stock item Tauri ships.
pub fn application_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let menu = Menu::default(app)?;
    let close_window_text = PredefinedMenuItem::close_window(app, None)?.text()?;
    // A row read back from a menu has lost its mnemonic marker (`C&lose`).
    let close_window_row_text = close_window_text.replace('&', "");
    for submenu in menu.items()?.iter().filter_map(|item| item.as_submenu()) {
        for (position, row) in submenu.items()?.iter().enumerate() {
            let Some(stock_row) = row.as_predefined_menuitem() else {
                continue;
            };
            if stock_row.text()? == close_window_row_text {
                submenu.remove_at(position)?;
                submenu.insert(
                    &MenuItem::with_id(
                        app,
                        CLOSE_WINDOW_MENU_ID,
                        &close_window_text,
                        true,
                        Some(CLOSE_WINDOW_ACCELERATOR),
                    )?,
                    position,
                )?;
            }
        }
    }
    Ok(menu)
}

/// Closes the main window the way the stock row did: a close request, so
/// the webview still gets to finish saving first.
pub fn close_window_on_request<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    if event.id() != CLOSE_WINDOW_MENU_ID {
        return;
    }
    if let Some(window) = app.get_webview_window(MAIN_WINDOW_LABEL)
        && let Err(error) = window.close()
    {
        eprintln!("could not close the window: {error}");
    }
}
