use mockall::predicate::eq;
use rstest::rstest;
use rustle_application::{ClipboardText, ReadClipboardText, WriteClipboardText};
use rustle_domain::{ClipboardError, MockClipboard};
use serde_json::json;

fn clipboard_holding(text: Option<&str>) -> MockClipboard {
    let mut clipboard = MockClipboard::new();
    let text = text.map(str::to_owned);
    clipboard.expect_text().returning(move || Ok(text.clone()));
    clipboard
}

#[test]
fn reads_the_text_another_app_copied() {
    let clipboard = clipboard_holding(Some("營收成長"));

    let answer = ReadClipboardText::new(&clipboard).execute();

    assert_eq!(
        answer,
        Ok(ClipboardText {
            text: Some("營收成長".to_owned())
        })
    );
    assert_eq!(
        serde_json::to_value(answer.expect("readable")).expect("serializable"),
        json!({ "text": "營收成長" })
    );
}

#[rstest]
#[case::nothing_at_all(None)]
#[case::an_empty_text(Some(""))]
fn a_clipboard_without_text_reads_as_no_text(#[case] held: Option<&str>) {
    let clipboard = clipboard_holding(held);

    let answer = ReadClipboardText::new(&clipboard).execute();

    assert_eq!(answer, Ok(ClipboardText { text: None }));
    assert_eq!(
        serde_json::to_value(answer.expect("readable")).expect("serializable"),
        json!({ "text": null })
    );
}

#[test]
fn a_clipboard_that_cannot_be_read_is_reported() {
    let mut clipboard = MockClipboard::new();
    clipboard
        .expect_text()
        .returning(|| Err(ClipboardError::Unreadable("locked".to_owned())));

    let answer = ReadClipboardText::new(&clipboard).execute();

    assert_eq!(answer, Err(ClipboardError::Unreadable("locked".to_owned())));
}

#[test]
fn writes_the_text_as_given_with_its_line_break() {
    let mut clipboard = MockClipboard::new();
    clipboard
        .expect_set_text()
        .with(eq("今日盤後觀察\n"))
        .times(1)
        .returning(|_| Ok(()));

    let answer = WriteClipboardText::new(&clipboard).execute("今日盤後觀察\n");

    assert_eq!(answer, Ok(()));
}

#[test]
fn a_clipboard_that_cannot_be_written_is_reported() {
    let mut clipboard = MockClipboard::new();
    clipboard
        .expect_set_text()
        .returning(|_| Err(ClipboardError::Unwritable("denied".to_owned())));

    let answer = WriteClipboardText::new(&clipboard).execute("台積電");

    assert_eq!(answer, Err(ClipboardError::Unwritable("denied".to_owned())));
}
