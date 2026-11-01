use super::*;
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
            "lastOpened": { "workspace": null, "article": null }
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
