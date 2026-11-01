use super::*;
use crate::InterfaceLanguage;
use serde_json::json;

fn read(stored: serde_json::Value) -> Settings {
    serde_json::from_value(stored).expect("any JSON object reads as settings")
}

#[test]
fn defaults_to_two_spaces_an_open_preview_and_nothing_last_opened() {
    let settings = Settings::default();

    assert_eq!(
        settings.indentation,
        IndentationSettings {
            style: IndentationStyle::Spaces,
            width: 2
        }
    );
    assert!(settings.preview_panel.is_open);
    assert_eq!(settings.last_opened, LastOpenedSettings::default());
}

#[test]
fn an_empty_object_reads_as_the_defaults() {
    assert_eq!(read(json!({})), Settings::default());
}

#[test]
fn reads_the_stored_values() {
    let settings = read(json!({
        "indentation": { "style": "spaces", "width": 4 },
        "previewPanel": { "isOpen": false, "widthRatio": 0.4 },
        "lastOpened": { "workspace": "Blog", "article": "zen-of-writing.md" }
    }));

    assert_eq!(
        settings,
        Settings {
            indentation: IndentationSettings {
                style: IndentationStyle::Spaces,
                width: 4
            },
            preview_panel: PreviewPanelSettings {
                is_open: false,
                width_ratio: 0.4,
                toggle_shortcut: None,
            },
            last_opened: LastOpenedSettings {
                workspace: Some("Blog".to_owned()),
                article: Some("zen-of-writing.md".to_owned()),
            },
            interface_language: None,
            sidebar: SidebarSettings::default(),
            font_size: FontSizeSettings::default(),
            theme: None,
        }
    );
}

#[test]
fn reads_a_tab_indentation() {
    let settings = read(json!({ "indentation": { "style": "tab", "width": 4 } }));

    assert_eq!(settings.indentation.style, IndentationStyle::Tab);
}

#[test]
fn normalizes_values_that_make_no_sense() {
    let settings = read(json!({
        "indentation": { "style": "curly", "width": 99 },
        "previewPanel": { "isOpen": true, "widthRatio": 5 },
        "lastOpened": { "workspace": 42, "article": "zen-of-writing.md" }
    }));

    assert_eq!(settings.indentation, IndentationSettings::default());
    assert!(settings.preview_panel.width_ratio > 0.0 && settings.preview_panel.width_ratio < 1.0);
    assert_eq!(settings.last_opened.workspace, None);
    assert_eq!(
        settings.last_opened.article,
        Some("zen-of-writing.md".to_owned())
    );
}

#[rstest::rstest]
#[case(json!(0))]
#[case(json!(-3))]
#[case(json!(300))]
#[case(json!("4"))]
fn falls_back_to_two_for_an_unusable_width(#[case] width: serde_json::Value) {
    let settings = read(json!({ "indentation": { "style": "tab", "width": width } }));

    assert_eq!(
        settings.indentation,
        IndentationSettings {
            style: IndentationStyle::Tab,
            width: 2
        }
    );
}

#[rstest::rstest]
#[case(json!(0))]
#[case(json!(1))]
#[case(json!(-0.5))]
#[case(json!("wide"))]
fn falls_back_to_half_for_an_unusable_width_ratio(#[case] width_ratio: serde_json::Value) {
    let settings = read(json!({ "previewPanel": { "isOpen": false, "widthRatio": width_ratio } }));

    assert_eq!(
        settings.preview_panel,
        PreviewPanelSettings {
            is_open: false,
            width_ratio: 0.5,
            toggle_shortcut: None,
        }
    );
}

#[test]
fn a_section_of_the_wrong_type_costs_only_that_section() {
    let settings = read(json!({
        "indentation": "four spaces",
        "lastOpened": { "workspace": "Blog", "article": null }
    }));

    assert_eq!(settings.indentation, IndentationSettings::default());
    assert_eq!(settings.last_opened.workspace, Some("Blog".to_owned()));
    assert_eq!(settings.last_opened.article, None);
}

#[test]
fn writes_the_fields_the_webview_reads() {
    let written = serde_json::to_value(Settings::default()).expect("serializable");

    assert_eq!(
        written,
        json!({
            "indentation": { "style": "spaces", "width": 2 },
            "previewPanel": { "isOpen": true, "widthRatio": 0.5 },
            "lastOpened": { "workspace": null, "article": null },
            "sidebar": { "collapsedSections": [] }
        })
    );
}

#[test]
fn has_no_vault_path_field() {
    let written = serde_json::to_value(Settings::default()).expect("serializable");

    let keys: Vec<&String> = written.as_object().expect("an object").keys().collect();
    assert!(
        keys.iter().all(|key| !key.to_lowercase().contains("vault")),
        "{keys:?}"
    );
}

#[test]
fn an_open_preview_has_no_opinion_on_its_toggle_shortcut_by_default() {
    let settings = read(json!({ "previewPanel": { "widthRatio": 0.5 } }));

    assert!(settings.preview_panel.is_open);
    assert_eq!(settings.preview_panel.toggle_shortcut, None);
}

#[test]
fn a_missing_preview_section_reads_as_open_without_a_shortcut() {
    let settings = read(json!({ "indentation": { "style": "tab", "width": 4 } }));

    assert!(settings.preview_panel.is_open);
    assert_eq!(settings.preview_panel.toggle_shortcut, None);
}

#[rstest::rstest]
#[case(json!(""))]
#[case(json!("   "))]
#[case(json!(42))]
#[case(json!(null))]
#[case(json!(["Mod", "Shift", "P"]))]
fn reads_no_opinion_from_an_unusable_toggle_shortcut(#[case] shortcut: serde_json::Value) {
    let settings = read(json!({ "previewPanel": { "isOpen": false, "toggleShortcut": shortcut } }));

    assert_eq!(settings.preview_panel.toggle_shortcut, None);
    assert!(!settings.preview_panel.is_open);
}

#[test]
fn reads_a_written_toggle_shortcut_as_written() {
    let settings = read(json!({ "previewPanel": { "toggleShortcut": "Mod+Alt+K" } }));

    assert_eq!(
        settings.preview_panel.toggle_shortcut,
        Some("Mod+Alt+K".to_owned())
    );
}

#[test]
fn writes_a_toggle_shortcut_only_when_there_is_one() {
    let mut settings = Settings::default();
    settings.preview_panel.toggle_shortcut = Some("Mod+Alt+K".to_owned());

    let written = serde_json::to_value(&settings).expect("serializable");

    assert_eq!(
        written["previewPanel"]["toggleShortcut"],
        json!("Mod+Alt+K")
    );
}

#[test]
fn has_no_interface_language_until_one_is_chosen() {
    assert_eq!(Settings::default().interface_language, None);
    assert_eq!(read(json!({})).interface_language, None);
}

#[rstest::rstest]
#[case(json!("zh"), InterfaceLanguage::Chinese)]
#[case(json!("en"), InterfaceLanguage::English)]
fn reads_the_chosen_interface_language(
    #[case] stored: serde_json::Value,
    #[case] expected: InterfaceLanguage,
) {
    let settings = read(json!({ "interfaceLanguage": stored }));

    assert_eq!(settings.interface_language, Some(expected));
}

#[rstest::rstest]
#[case(json!("klingon"))]
#[case(json!("ZH"))]
#[case(json!(42))]
#[case(json!(null))]
#[case(json!({ "language": "en" }))]
fn reads_an_unusable_interface_language_as_never_chosen(#[case] stored: serde_json::Value) {
    let settings = read(json!({
        "interfaceLanguage": stored,
        "indentation": { "style": "tab", "width": 4 }
    }));

    assert_eq!(settings.interface_language, None);
    assert_eq!(settings.indentation.style, IndentationStyle::Tab);
}

#[test]
fn writes_the_interface_language_only_once_chosen() {
    let mut settings = Settings::default();
    let unchosen = serde_json::to_value(&settings).expect("serializable");
    settings.interface_language = Some(InterfaceLanguage::English);

    let chosen = serde_json::to_value(&settings).expect("serializable");

    assert!(unchosen.get("interfaceLanguage").is_none());
    assert_eq!(chosen["interfaceLanguage"], json!("en"));
}

#[test]
fn starts_with_every_sidebar_section_expanded() {
    assert!(Settings::default().sidebar.collapsed_sections.is_empty());
}

#[test]
fn reads_the_collapsed_sidebar_sections() {
    let settings = read(json!({ "sidebar": { "collapsedSections": ["tags", "workspaces"] } }));

    assert_eq!(
        settings.sidebar.collapsed_sections,
        [SidebarSection::Tags, SidebarSection::Workspaces]
    );
}

#[rstest::rstest]
#[case::unknown_section(json!({ "sidebar": { "collapsedSections": ["trash"] } }), &[])]
#[case::unknown_among_known(json!({ "sidebar": { "collapsedSections": ["trash", "status", 3] } }), &[SidebarSection::Status])]
#[case::repeated(json!({ "sidebar": { "collapsedSections": ["tags", "tags"] } }), &[SidebarSection::Tags])]
#[case::not_a_list(json!({ "sidebar": { "collapsedSections": "tags" } }), &[])]
#[case::not_an_object(json!({ "sidebar": true }), &[])]
fn ignores_collapsed_sections_it_does_not_know(
    #[case] stored: serde_json::Value,
    #[case] expected: &[SidebarSection],
) {
    assert_eq!(read(stored).sidebar.collapsed_sections, expected);
}

#[test]
fn writes_the_collapsed_sections_by_name() {
    let settings = Settings {
        sidebar: SidebarSettings {
            collapsed_sections: vec![SidebarSection::Status],
        },
        ..Settings::default()
    };

    assert_eq!(
        serde_json::to_value(&settings).expect("serializable")["sidebar"],
        json!({ "collapsedSections": ["status"] })
    );
}

#[test]
fn has_no_font_size_opinion_until_one_is_written() {
    assert_eq!(read(json!({})).font_size, FontSizeSettings::default());
    assert!(
        serde_json::to_value(Settings::default())
            .expect("serializable")
            .get("fontSize")
            .is_none()
    );
}

#[test]
fn reads_the_written_font_sizes_as_written() {
    let settings = read(json!({ "fontSize": { "editor": 17.3, "preview": 999 } }));

    assert_eq!(
        settings.font_size,
        FontSizeSettings {
            editor: Some(17.3),
            preview: Some(999.0),
        }
    );
}

#[rstest::rstest]
#[case::text(json!({ "fontSize": { "editor": "huge", "preview": 13 } }), None, Some(13.0))]
#[case::null(json!({ "fontSize": { "editor": null } }), None, None)]
#[case::not_an_object(json!({ "fontSize": 16 }), None, None)]
fn reads_a_font_size_that_is_not_a_number_as_no_opinion(
    #[case] stored: serde_json::Value,
    #[case] editor: Option<f64>,
    #[case] preview: Option<f64>,
) {
    assert_eq!(read(stored).font_size, FontSizeSettings { editor, preview });
}

#[test]
fn writes_only_the_font_sizes_it_has() {
    let settings = Settings {
        font_size: FontSizeSettings {
            editor: None,
            preview: Some(13.5),
        },
        ..Settings::default()
    };

    assert_eq!(
        serde_json::to_value(&settings).expect("serializable")["fontSize"],
        json!({ "preview": 13.5 })
    );
}

#[test]
fn has_no_theme_until_one_is_chosen() {
    let settings = read(json!({}));

    assert_eq!(settings.theme, None);
    assert!(
        serde_json::to_value(&settings)
            .expect("serializable")
            .get("theme")
            .is_none()
    );
}

#[test]
fn reads_and_writes_the_chosen_theme_as_written() {
    let settings = read(json!({ "theme": "someThemeNoOneShips" }));

    assert_eq!(settings.theme, Some("someThemeNoOneShips".to_owned()));
    assert_eq!(
        serde_json::to_value(&settings).expect("serializable")["theme"],
        json!("someThemeNoOneShips")
    );
}

#[rstest::rstest]
#[case::number(json!({ "theme": 3 }))]
#[case::object(json!({ "theme": { "name": "forest" } }))]
#[case::null(json!({ "theme": null }))]
fn reads_a_theme_that_is_not_a_name_as_no_choice(#[case] stored: serde_json::Value) {
    assert_eq!(read(stored).theme, None);
}

#[test]
fn a_broken_theme_costs_no_other_setting() {
    let settings = read(json!({ "theme": 3, "interfaceLanguage": "en" }));

    assert_eq!(
        settings.interface_language,
        Some(InterfaceLanguage::English)
    );
}
