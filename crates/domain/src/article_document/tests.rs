use rstest::rstest;

use super::*;

const BOM: &str = "\u{feff}";

const ANNOTATED_FRONT_MATTER: &str = "---
# 這個檔案是什麼
title: Tauri 與 Electron 的取捨
created_at: 2026-08-20T14:32:05+08:00
updated_at: 2026-08-20T16:04:11+08:00
draft: true
category:
  - 技術筆記 # 這一項的註解
  - 桌面開發
tags:
  - electron

# 區塊最後的註解
---
";

const NEW_UPDATED_AT: &str = "2026-09-01T09:00:00+08:00";

fn annotated_article() -> String {
    format!("{ANNOTATED_FRONT_MATTER}\n原本的正文。\n")
}

fn file_name(name: &str) -> ArticleFileName {
    ArticleFileName::parse(name).expect("valid article file name")
}

fn metadata_of(text: &str) -> ArticleMetadata {
    ArticleDocument::parse(text).metadata(&file_name("zen-of-writing.md"))
}

fn rewritten(text: &str, update: &MetadataUpdate) -> String {
    ArticleDocument::parse(text).with_metadata(update).to_text()
}

fn front_matter_block(text: &str) -> &str {
    let after_opening = text.find("---").expect("has an opening delimiter") + 3;
    let closing = text[after_opening..]
        .find("\n---")
        .expect("has a closing delimiter");
    &text[..after_opening + closing + 4]
}

fn top_level_keys(text: &str) -> Vec<&str> {
    front_matter_block(text)
        .lines()
        .filter(|line| !line.starts_with([' ', '#', '-']) && line.contains(':'))
        .filter_map(|line| line.split(':').next())
        .collect()
}

mod stripping_front_matter {
    use super::*;

    #[test]
    fn hands_over_only_the_body() {
        let document =
            ArticleDocument::parse("---\ntitle: Zen of Writing\n---\n\n正文的第一行。\n");

        assert_eq!(document.body(), "\n正文的第一行。\n");
        assert!(!document.body().contains("---"));
        assert!(!document.body().contains("title:"));
    }

    #[test]
    fn keeps_a_horizontal_rule_in_the_body() {
        let document =
            ArticleDocument::parse("---\ntitle: Zen\n---\n第一段。\n\n---\n\n第二段。\n");

        assert_eq!(document.body(), "第一段。\n\n---\n\n第二段。\n");
    }

    #[rstest]
    #[case::no_front_matter("# 只有正文\n\n第二段。\n")]
    #[case::opening_without_closing("---\ntitle: Zen\n\n正文。\n")]
    #[case::delimiter_not_on_the_first_line("\n---\ntitle: Zen\n---\n正文。\n")]
    #[case::only_a_delimiter("---")]
    fn treats_the_whole_file_as_body_without_a_leading_pair_of_delimiters(#[case] text: &str) {
        assert_eq!(ArticleDocument::parse(text).body(), text);
    }

    #[test]
    fn strips_an_empty_front_matter() {
        assert_eq!(
            ArticleDocument::parse("---\n---\n正文。\n").body(),
            "正文。\n"
        );
    }

    #[test]
    fn recognises_front_matter_after_a_byte_order_mark() {
        let document = ArticleDocument::parse(&format!("{BOM}---\ntitle: Zen\n---\n正文。\n"));

        assert_eq!(document.body(), "正文。\n");
        assert!(!document.body().contains(BOM));
    }

    #[test]
    fn keeps_crlf_line_breaks_in_the_body() {
        let document =
            ArticleDocument::parse("---\r\ntitle: Zen\r\n---\r\n第一行。\r\n第二行。\r\n");

        assert_eq!(document.body(), "第一行。\r\n第二行。\r\n");
    }

    #[test]
    fn strips_a_front_matter_that_is_not_valid_yaml() {
        let document =
            ArticleDocument::parse("---\ntitle: Zen\n  broken: indentation\n---\n正文。\n");

        assert_eq!(document.body(), "正文。\n");
    }

    #[test]
    fn keeps_the_body_byte_for_byte() {
        let body = "\n\n第一段，行尾有空白。   \n\n\n第二段\t\n";

        assert_eq!(
            ArticleDocument::parse(&format!("---\ntitle: Zen\n---\n{body}")).body(),
            body
        );
    }

    #[test]
    fn accepts_delimiters_with_trailing_spaces() {
        assert_eq!(
            ArticleDocument::parse("---  \ntitle: Zen\n---\t\n正文。\n").body(),
            "正文。\n"
        );
    }

    #[test]
    fn gives_up_the_body_by_value() {
        assert_eq!(
            ArticleDocument::parse("---\n---\n正文。\n").into_body(),
            "正文。\n"
        );
    }
}

mod reading_metadata {
    use super::*;

    #[test]
    fn reads_all_five_fields_as_written() {
        let metadata = metadata_of(&annotated_article());

        assert_eq!(
            metadata,
            ArticleMetadata {
                title: "Tauri 與 Electron 的取捨".to_owned(),
                created_at: "2026-08-20T14:32:05+08:00".to_owned(),
                updated_at: "2026-08-20T16:04:11+08:00".to_owned(),
                status: None,
                tags: vec!["electron".to_owned()],
                has_incomplete_metadata: false,
            }
        );
    }

    #[test]
    fn leaves_the_retired_category_out_of_tags_and_status() {
        let metadata = metadata_of("---\ntitle: Zen\ncategory: 技術筆記\n---\n");

        assert!(metadata.tags.is_empty());
        assert_eq!(metadata.status, None);
    }

    #[test]
    fn reads_a_single_string_tag_as_a_one_item_list() {
        let metadata = metadata_of("---\ntitle: Zen\ntags: electron\n---\n");

        assert_eq!(metadata.tags, vec!["electron".to_owned()]);
    }

    #[test]
    fn reads_a_tag_written_twice_once() {
        let metadata = metadata_of("---\ntitle: Zen\ntags: [rust, tauri, rust]\n---\n");

        assert_eq!(metadata.tags, vec!["rust".to_owned(), "tauri".to_owned()]);
    }

    #[test]
    fn reads_missing_status_and_tags_as_nothing() {
        let metadata = metadata_of("---\ntitle: Zen\n---\n");

        assert_eq!(metadata.status, None);
        assert!(metadata.tags.is_empty());
    }

    #[test]
    fn skips_list_items_that_are_not_text() {
        let metadata = metadata_of("---\ntitle: Zen\ntags:\n  - electron\n  - 12\n  - true\n---\n");

        assert_eq!(metadata.tags, vec!["electron".to_owned()]);
    }

    #[rstest]
    #[case::missing_key("---\ncreated_at: 2026-08-20T14:32:05+08:00\n---\n")]
    #[case::empty_value("---\ntitle:\n---\n")]
    #[case::blank_text("---\ntitle: \"   \"\n---\n")]
    #[case::not_text("---\ntitle: 2026\n---\n")]
    #[case::no_front_matter("只有正文。\n")]
    fn falls_back_to_the_file_name_and_marks_the_metadata_incomplete(#[case] text: &str) {
        let metadata = metadata_of(text);

        assert_eq!(metadata.title, "zen-of-writing");
        assert!(metadata.has_incomplete_metadata);
    }

    #[test]
    fn keeps_non_ascii_characters_of_the_fallback_title() {
        let metadata =
            ArticleDocument::parse("---\n---\n").metadata(&file_name("台積電-法說會.md"));

        assert_eq!(metadata.title, "台積電-法說會");
    }

    #[test]
    fn does_not_mark_an_article_with_a_title_incomplete() {
        let metadata = metadata_of("---\ntitle: Zen of Writing\n---\n");

        assert_eq!(metadata.title, "Zen of Writing");
        assert!(!metadata.has_incomplete_metadata);
    }

    #[test]
    fn reads_missing_times_as_empty_text_without_marking_incomplete() {
        let metadata = metadata_of("---\ntitle: Zen\n---\n");

        assert_eq!(metadata.created_at, "");
        assert_eq!(metadata.updated_at, "");
        assert!(!metadata.has_incomplete_metadata);
    }

    #[rstest]
    #[case::bad_indentation("---\ntitle: Zen\n  broken: indentation\n---\n")]
    #[case::duplicate_key("---\ntitle: Zen\ntitle: Again\n---\n")]
    #[case::not_a_mapping("---\n- just\n- a list\n---\n")]
    fn falls_back_when_the_front_matter_cannot_be_read(#[case] text: &str) {
        let metadata = metadata_of(text);

        assert_eq!(metadata.title, "zen-of-writing");
        assert!(metadata.has_incomplete_metadata);
        assert!(metadata.tags.is_empty());
    }
}

mod writing_back {
    use super::*;

    #[test]
    fn replacing_only_the_body_keeps_the_front_matter_verbatim() {
        let text = ArticleDocument::parse(&annotated_article())
            .with_body("新的正文。\n")
            .to_text();

        assert_eq!(text, format!("{ANNOTATED_FRONT_MATTER}新的正文。\n"));
    }

    #[test]
    fn renders_an_untouched_document_byte_for_byte() {
        for text in [
            annotated_article(),
            format!("{BOM}---  \r\ntitle: Zen\r\n---\t\r\n\r\n正文\r\n"),
            "---\ntitle: Zen\n---".to_owned(),
            "沒有 front matter".to_owned(),
        ] {
            assert_eq!(ArticleDocument::parse(&text).to_text(), text);
        }
    }

    #[test]
    fn updating_updated_at_changes_only_that_value() {
        let text = ArticleDocument::parse(&annotated_article())
            .with_body("新的正文。\n")
            .with_metadata(&MetadataUpdate::default().updated_at(NEW_UPDATED_AT))
            .to_text();

        let expected_front_matter = ANNOTATED_FRONT_MATTER.replace(
            "updated_at: 2026-08-20T16:04:11+08:00",
            &format!("updated_at: {NEW_UPDATED_AT}"),
        );
        assert_eq!(text, format!("{expected_front_matter}新的正文。\n"));
        let metadata = metadata_of(&text);
        assert_eq!(metadata.updated_at, NEW_UPDATED_AT);
        assert_eq!(metadata.title, "Tauri 與 Electron 的取捨");
        assert_eq!(metadata.created_at, "2026-08-20T14:32:05+08:00");
        assert!(text.contains("draft: true\n"));
        assert_eq!(
            top_level_keys(&text),
            [
                "title",
                "created_at",
                "updated_at",
                "draft",
                "category",
                "tags"
            ]
        );
    }

    #[test]
    fn keeps_comments_at_the_top_after_an_item_and_at_the_end() {
        let text = rewritten(
            &annotated_article(),
            &MetadataUpdate::default().updated_at(NEW_UPDATED_AT),
        );

        let block = front_matter_block(&text);
        assert!(block.starts_with("---\n# 這個檔案是什麼\ntitle:"));
        assert!(block.contains("  - 技術筆記 # 這一項的註解\n"));
        assert!(block.ends_with("\n# 區塊最後的註解\n---"));
    }

    #[test]
    fn updating_metadata_alone_keeps_the_body() {
        let text = rewritten(
            &annotated_article(),
            &MetadataUpdate::default().updated_at(NEW_UPDATED_AT),
        );

        assert_eq!(ArticleDocument::parse(&text).body(), "\n原本的正文。\n");
    }

    #[test]
    fn never_folds_a_long_value() {
        let long_title = "A very long title that keeps going well past eighty characters so a YAML emitter might fold it";
        let text = rewritten(
            &format!("---\ntitle: {long_title}\nupdated_at: old\n---\n"),
            &MetadataUpdate::default().updated_at(NEW_UPDATED_AT),
        );

        assert!(text.contains(&format!("\ntitle: {long_title}\n")));
    }

    #[test]
    fn keeps_a_comment_after_a_replaced_value() {
        let text = rewritten(
            "---\nupdated_at: old   # 自動更新\n---\n",
            &MetadataUpdate::default().updated_at(NEW_UPDATED_AT),
        );

        assert_eq!(
            text,
            format!("---\nupdated_at: {NEW_UPDATED_AT}   # 自動更新\n---\n")
        );
    }
}

mod writing_lists {
    use super::*;

    #[test]
    fn writes_a_single_item_as_a_block_list() {
        let text = rewritten(
            "---\ntitle: Zen\n---\n",
            &MetadataUpdate::default().tags(["electron"]),
        );

        assert!(text.contains("\ntags:\n  - electron\n"));
        assert!(!text.contains("tags: electron"));
    }

    #[test]
    fn turns_a_single_string_into_a_block_list() {
        let text = rewritten(
            "---\ntitle: Zen\ntags: 舊標籤\n---\n",
            &MetadataUpdate::default().tags(["技術筆記"]),
        );

        assert_eq!(text, "---\ntitle: Zen\ntags:\n  - 技術筆記\n---\n");
    }

    #[test]
    fn keeps_the_comment_of_a_single_string_turned_into_a_block_list() {
        let text = rewritten(
            "---\ntags: 舊標籤 # 備註\n---\n",
            &MetadataUpdate::default().tags(["技術筆記"]),
        );

        assert_eq!(text, "---\ntags: # 備註\n  - 技術筆記\n---\n");
        assert_eq!(metadata_of(&text).tags, ["技術筆記"]);
    }

    #[test]
    fn removes_the_key_when_the_list_is_empty() {
        let text = rewritten(
            &annotated_article(),
            &MetadataUpdate::default().tags(Vec::<String>::new()),
        );

        assert!(!text.contains("tags"));
        assert!(!text.contains("electron"));
        assert_eq!(
            top_level_keys(&text),
            ["title", "created_at", "updated_at", "draft", "category"]
        );
    }

    #[test]
    fn replacing_title_and_lists_keeps_unknown_fields_order_and_comments() {
        let text = rewritten(
            &annotated_article(),
            &MetadataUpdate::default()
                .title("新的標題")
                .tags(["tauri", "rust"]),
        );

        let metadata = metadata_of(&text);
        assert_eq!(metadata.title, "新的標題");
        assert!(text.contains("category:\n  - 技術筆記 # 這一項的註解\n  - 桌面開發\n"));
        assert_eq!(metadata.tags, ["tauri", "rust"]);
        assert_eq!(
            top_level_keys(&text),
            [
                "title",
                "created_at",
                "updated_at",
                "draft",
                "category",
                "tags"
            ]
        );
        assert!(text.contains("\ndraft: true\n"));
        assert!(text.contains("# 這個檔案是什麼\n"));
        assert!(text.contains("  - 技術筆記 # 這一項的註解\n"));
        assert!(text.contains("\n# 區塊最後的註解\n---\n"));
    }

    #[test]
    fn creates_a_front_matter_when_there_was_none() {
        let text = rewritten(
            "# 只有正文\n",
            &MetadataUpdate::default()
                .title("Zen of Writing")
                .tags(["技術筆記"]),
        );

        assert_eq!(
            text,
            "---\ntitle: Zen of Writing\ntags:\n  - 技術筆記\n---\n# 只有正文\n"
        );
    }

    #[test]
    fn creates_nothing_when_there_is_nothing_to_write() {
        let text = rewritten(
            "# 只有正文\n",
            &MetadataUpdate::default().tags(Vec::<String>::new()),
        );

        assert_eq!(text, "# 只有正文\n");
    }

    #[test]
    fn adds_keys_after_the_comments_of_a_block_without_entries() {
        let text = rewritten(
            "---\n# 只有註解\n---\n",
            &MetadataUpdate::default().title("Zen"),
        );

        assert_eq!(text, "---\n# 只有註解\ntitle: Zen\n---\n");
    }

    #[test]
    fn adds_missing_keys_after_the_last_entry() {
        let text = rewritten(
            "---\n# 開頭\ntitle: Zen\n\n# 結尾\n---\n",
            &MetadataUpdate::default()
                .created_at("2026-08-20T14:32:05+08:00")
                .tags(["a"]),
        );

        assert_eq!(
            text,
            "---\n# 開頭\ntitle: Zen\ncreated_at: 2026-08-20T14:32:05+08:00\ntags:\n  - a\n\n# 結尾\n---\n"
        );
    }
}

mod line_endings_and_broken_blocks {
    use super::*;

    #[test]
    fn writes_crlf_inside_a_crlf_front_matter() {
        let text = rewritten(
            "---\r\ntitle: Zen\r\nupdated_at: old\r\n---\r\n正文\r\n",
            &MetadataUpdate::default()
                .updated_at(NEW_UPDATED_AT)
                .tags(["a"]),
        );

        assert_eq!(
            text,
            format!(
                "---\r\ntitle: Zen\r\nupdated_at: {NEW_UPDATED_AT}\r\ntags:\r\n  - a\r\n---\r\n正文\r\n"
            )
        );
    }

    #[test]
    fn creates_a_crlf_front_matter_for_a_crlf_body() {
        let text = rewritten("正文\r\n", &MetadataUpdate::default().title("Zen"));

        assert_eq!(text, "---\r\ntitle: Zen\r\n---\r\n正文\r\n");
    }

    #[test]
    fn keeps_the_byte_order_mark() {
        let text = rewritten(
            &format!("{BOM}---\ntitle: Zen\nupdated_at: old\n---\n正文\n"),
            &MetadataUpdate::default().updated_at(NEW_UPDATED_AT),
        );

        assert!(text.starts_with(&format!("{BOM}---\n")));
        assert!(text.contains(&format!("updated_at: {NEW_UPDATED_AT}\n")));
    }

    #[test]
    fn keeps_a_broken_front_matter_verbatim_while_saving_the_body() {
        let broken = "---\ntitle: Zen\n  broken: indentation\nupdated_at: old\n---\n";

        let text = ArticleDocument::parse(&format!("{broken}舊的正文。\n"))
            .with_body("新的正文。\n")
            .with_metadata(&MetadataUpdate::default().updated_at(NEW_UPDATED_AT))
            .to_text();

        assert_eq!(text, format!("{broken}新的正文。\n"));
    }

    #[test]
    fn keeps_a_flow_mapping_it_cannot_edit_line_by_line() {
        let text = rewritten(
            "---\n{title: Zen}\n---\n",
            &MetadataUpdate::default().tags(["a"]),
        );

        assert_eq!(text, "---\n{title: Zen}\n---\n");
    }

    #[test]
    fn keeps_a_block_whose_edit_would_land_in_the_wrong_yaml_document() {
        let block = "---\ntitle: Zen\n...\ntags: old\n---\n";

        let text = rewritten(block, &MetadataUpdate::default().tags(["new"]));

        assert_eq!(text, block);
    }

    #[test]
    fn edits_a_block_that_uses_explicit_keys() {
        let text = rewritten(
            "---\n? title\n: Zen\n---\n",
            &MetadataUpdate::default().tags(["a"]),
        );

        let metadata = metadata_of(&text);
        assert_eq!(metadata.title, "Zen");
        assert_eq!(metadata.tags, ["a"]);
        assert!(text.starts_with("---\n? title\n: Zen\n"));
    }

    #[test]
    fn replaces_tags_written_as_a_block_of_text() {
        let text = rewritten(
            "---\ntags: |\n  - 'not an item\n---\n",
            &MetadataUpdate::default().tags(["技術筆記"]),
        );

        assert_eq!(text, "---\ntags:\n  - 技術筆記\n---\n");
    }

    #[test]
    fn starts_the_body_on_its_own_line_after_a_closing_delimiter_at_the_end() {
        let text = ArticleDocument::parse("---\ntitle: Zen\n---")
            .with_body("正文")
            .to_text();

        assert_eq!(text, "---\ntitle: Zen\n---\n正文");
    }
}

mod writing_scalars {
    use super::*;

    #[rstest]
    #[case::plain_text("Zen of Writing", "Zen of Writing")]
    #[case::number_like("2026", "\"2026\"")]
    #[case::boolean_like("true", "\"true\"")]
    #[case::yaml_1_1_yes("yes", "\"yes\"")]
    #[case::yaml_1_1_no("No", "\"No\"")]
    #[case::yaml_1_1_on("ON", "\"ON\"")]
    #[case::yaml_1_1_off("off", "\"off\"")]
    #[case::yaml_1_1_single_letter("y", "\"y\"")]
    #[case::word_starting_like_a_boolean("yesterday", "yesterday")]
    #[case::colon_and_space("A: B", "\"A: B\"")]
    #[case::hash_after_space("C # sharp", "\"C # sharp\"")]
    #[case::leading_indicator("- dash", "\"- dash\"")]
    #[case::quotes_inside("say \"hi\" \\o/", "say \"hi\" \\o/")]
    #[case::quotes_and_backslash_need_escaping("\"quoted\" \\", "\"\\\"quoted\\\" \\\\\"")]
    #[case::line_break("first\nsecond\r", "\"first\\nsecond\\r\"")]
    #[case::tab("a\tb", "\"a\\tb\"")]
    #[case::control_character("bell\u{7}", "\"bell\\u0007\"")]
    fn writes_text_so_yaml_reads_back_the_same_text(#[case] title: &str, #[case] written: &str) {
        let text = rewritten(
            "---\ntitle: old\n---\n",
            &MetadataUpdate::default().title(title),
        );

        assert_eq!(text, format!("---\ntitle: {written}\n---\n"));
        assert_eq!(metadata_of(&text).title, title);
    }

    #[test]
    fn writes_empty_text_as_an_empty_quoted_string() {
        let text = rewritten(
            "---\ncreated_at: old\n---\n",
            &MetadataUpdate::default().created_at(""),
        );

        assert_eq!(text, "---\ncreated_at: \"\"\n---\n");
    }
}

mod editing_metadata_strictly {
    use super::*;

    #[test]
    fn edits_like_the_tolerant_update_when_the_block_can_be_edited() {
        let update = MetadataUpdate::default().title("新的標題").tags(["rust"]);

        let edited = ArticleDocument::parse(&annotated_article())
            .edit_metadata(&update)
            .expect("an editable block");

        assert_eq!(edited.to_text(), rewritten(&annotated_article(), &update));
    }

    #[test]
    fn creates_a_front_matter_for_an_article_without_one() {
        let edited = ArticleDocument::parse("只有正文。\n")
            .edit_metadata(&MetadataUpdate::default().title("Zen"))
            .expect("nothing to break");

        assert_eq!(edited.to_text(), "---\ntitle: Zen\n---\n只有正文。\n");
    }

    #[rstest]
    #[case::broken_yaml("---\ntitle: Zen\n  broken: indentation\n---\n正文\n")]
    #[case::not_a_mapping("---\n- just\n- a list\n---\n正文\n")]
    #[case::flow_mapping("---\n{title: Zen}\n---\n正文\n")]
    fn refuses_a_block_it_cannot_edit_safely(#[case] text: &str) {
        assert_eq!(
            ArticleDocument::parse(text).edit_metadata(&MetadataUpdate::default().title("新的")),
            Err(UneditableFrontMatter)
        );
    }
}

mod status {
    use super::*;

    #[rstest]
    #[case("---\ntitle: Zen\nstatus: active\n---\n", Some(ArticleStatus::Active))]
    #[case("---\ntitle: Zen\nstatus: On Hold\n---\n", Some(ArticleStatus::OnHold))]
    #[case("---\ntitle: Zen\nstatus: 進行中\n---\n", None)]
    #[case("---\ntitle: Zen\nstatus: [active]\n---\n", None)]
    #[case("---\ntitle: Zen\n---\n", None)]
    fn reads_a_recognised_status_or_none(
        #[case] text: &str,
        #[case] expected: Option<ArticleStatus>,
    ) {
        assert_eq!(metadata_of(text).status, expected);
        assert_eq!(ArticleDocument::parse(text).status(), expected);
    }

    #[test]
    fn writes_a_status_in_place_of_the_old_line() {
        let text = rewritten(
            "---\ntitle: Zen\nstatus: 進行中 # 手寫\ntags:\n  - a\n---\n",
            &MetadataUpdate::default().status(ArticleStatus::OnHold),
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nstatus: on-hold # 手寫\ntags:\n  - a\n---\n"
        );
    }

    #[test]
    fn removes_the_status_line_only_when_asked() {
        let text = rewritten(
            "---\ntitle: Zen\nstatus: active\ntags:\n  - a\n---\n",
            &MetadataUpdate::default().without_status(),
        );

        assert_eq!(text, "---\ntitle: Zen\ntags:\n  - a\n---\n");
    }

    #[test]
    fn removing_a_missing_status_creates_nothing() {
        assert_eq!(
            rewritten("# 只有正文\n", &MetadataUpdate::default().without_status()),
            "# 只有正文\n"
        );
    }
}
