//! Native menus can only be built on the main thread, so this file runs
//! without the test harness: `main` calls each check in turn. The app only
//! installs its own menu on macOS.
#![cfg_attr(not(target_os = "macos"), allow(dead_code, unused_imports))]

use muda::accelerator::{Accelerator, Code, Modifiers};
use rustle_lib::application_menu::{
    CLOSE_WINDOW_ACCELERATOR, CLOSE_WINDOW_MENU_ID, application_menu,
};
use tauri::menu::{Menu, MenuItemKind};
use tauri::test::{MockRuntime, mock_app};

/// Every row as `submenu / kind / text`, in menu order.
fn rows(menu: &Menu<MockRuntime>) -> Vec<String> {
    let mut rows = Vec::new();
    for item in menu.items().expect("menu items") {
        let submenu = item.as_submenu().expect("only submenus at the top");
        let title = submenu.text().expect("submenu title");
        for row in submenu.items().expect("submenu rows") {
            let (kind, text) = match &row {
                MenuItemKind::MenuItem(item) => ("custom", item.text()),
                MenuItemKind::Predefined(item) => ("stock", item.text()),
                MenuItemKind::Submenu(item) => ("submenu", item.text()),
                MenuItemKind::Check(item) => ("check", item.text()),
                MenuItemKind::Icon(item) => ("icon", item.text()),
            };
            rows.push(format!("{title} / {kind} / {}", text.expect("row text")));
        }
    }
    rows
}

fn rebinds_every_close_window_row_and_keeps_its_place() {
    let app = mock_app();
    let stock = rows(&Menu::default(app.handle()).expect("stock menu"));

    let rebound = rows(&application_menu(app.handle()).expect("application menu"));

    let expected: Vec<String> = stock
        .iter()
        .map(|row| row.replace("stock / Close Window", "custom / Close Window"))
        .collect();
    assert_eq!(rebound, expected);
    assert_eq!(
        rebound
            .iter()
            .filter(|row| row.ends_with("custom / Close Window"))
            .count(),
        2
    );
}

fn gives_the_close_window_rows_their_own_id() {
    let app = mock_app();
    let menu = application_menu(app.handle()).expect("application menu");

    let ids: Vec<String> = menu
        .items()
        .expect("menu items")
        .iter()
        .filter_map(|item| item.as_submenu().cloned())
        .flat_map(|submenu| submenu.items().expect("submenu rows"))
        .filter_map(|row| row.as_menuitem().map(|item| item.id().0.clone()))
        .collect();

    assert_eq!(ids, [CLOSE_WINDOW_MENU_ID, CLOSE_WINDOW_MENU_ID]);
}

fn binds_close_window_to_shift_command_w() {
    let accelerator: Accelerator = CLOSE_WINDOW_ACCELERATOR
        .parse()
        .expect("a valid accelerator");

    assert_eq!(
        accelerator,
        Accelerator::new(Modifiers::SHIFT | Modifiers::META, Code::KeyW)
    );
}

#[cfg(target_os = "macos")]
fn main() {
    let checks: [(&str, fn()); 3] = [
        (
            "rebinds every close window row and keeps its place",
            rebinds_every_close_window_row_and_keeps_its_place,
        ),
        (
            "gives the close window rows their own id",
            gives_the_close_window_rows_their_own_id,
        ),
        (
            "binds close window to shift command w",
            binds_close_window_to_shift_command_w,
        ),
    ];
    for (name, check) in checks {
        check();
        println!("test {name} ... ok");
    }
}

#[cfg(not(target_os = "macos"))]
fn main() {}
