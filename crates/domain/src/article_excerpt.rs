const CHARACTER_LIMIT: usize = 120;
const ELLIPSIS: char = '…';
const EMPHASIS_MARKS: [&str; 4] = ["**", "__", "~~", "`"];
const TASK_BOXES: [&str; 3] = ["[ ] ", "[x] ", "[X] "];

/// The opening words of an article's body as a reader sees them: headings,
/// images, code blocks and Markdown marks left out, lines joined by a single
/// space, at most 120 characters before an ellipsis.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleExcerpt(String);

impl ArticleExcerpt {
    /// `None` when the body holds no readable text.
    pub fn from_body(body: &str) -> Option<Self> {
        let mut words = String::new();
        let mut inside_code_block = false;
        for line in body.lines() {
            let line = line.trim();
            if line.starts_with("```") || line.starts_with("~~~") {
                inside_code_block = !inside_code_block;
                continue;
            }
            if inside_code_block || Self::is_heading(line) || Self::is_thematic_break(line) {
                continue;
            }
            for word in Self::readable_text(Self::without_block_marks(line)).split_whitespace() {
                if !words.is_empty() {
                    words.push(' ');
                }
                words.push_str(word);
            }
            if words.chars().count() > CHARACTER_LIMIT {
                break;
            }
        }
        (!words.is_empty()).then(|| Self(Self::shortened(words)))
    }

    pub fn into_string(self) -> String {
        self.0
    }
}

impl ArticleExcerpt {
    fn shortened(words: String) -> String {
        match words.char_indices().nth(CHARACTER_LIMIT) {
            Some((cut, _)) => format!("{}{ELLIPSIS}", &words[..cut]),
            None => words,
        }
    }

    fn is_heading(line: &str) -> bool {
        let after_hashes = line.trim_start_matches('#');
        line.starts_with('#')
            && (after_hashes.is_empty() || after_hashes.starts_with(char::is_whitespace))
    }

    fn is_thematic_break(line: &str) -> bool {
        let marks: String = line.chars().filter(|c| !c.is_whitespace()).collect();
        marks.len() >= 3
            && ['-', '*', '_']
                .iter()
                .any(|mark| marks.chars().all(|c| c == *mark))
    }

    fn without_block_marks(line: &str) -> &str {
        let mut rest = line;
        loop {
            let stripped = rest
                .strip_prefix('>')
                .or_else(|| {
                    ["- ", "* ", "+ "]
                        .iter()
                        .find_map(|mark| rest.strip_prefix(mark))
                })
                .or_else(|| TASK_BOXES.iter().find_map(|mark| rest.strip_prefix(mark)))
                .or_else(|| Self::without_ordered_list_mark(rest));
            match stripped {
                Some(next) => rest = next.trim_start(),
                None => return rest,
            }
        }
    }

    fn without_ordered_list_mark(line: &str) -> Option<&str> {
        let after_digits = line.trim_start_matches(|c: char| c.is_ascii_digit());
        if after_digits.len() == line.len() {
            return None;
        }
        after_digits
            .strip_prefix(". ")
            .or_else(|| after_digits.strip_prefix(") "))
    }

    /// Links keep their text, images disappear, emphasis and code marks go.
    fn readable_text(line: &str) -> String {
        let mut text = String::new();
        let mut rest = line;
        while let Some(open) = rest.find('[') {
            let is_image = rest[..open].ends_with('!');
            let before = if is_image {
                &rest[..open - 1]
            } else {
                &rest[..open]
            };
            text.push_str(before);
            match Self::link_parts(&rest[open..]) {
                Some((label, after)) => {
                    if !is_image {
                        text.push_str(label);
                    }
                    rest = after;
                }
                None => {
                    text.push_str(&rest[before.len()..=open]);
                    rest = &rest[open + 1..];
                }
            }
        }
        text.push_str(rest);
        Self::without_emphasis(&text)
    }

    /// `[label](target)rest` → `(label, rest)`.
    fn link_parts(text: &str) -> Option<(&str, &str)> {
        let close = text.find("](")?;
        let after_target = text[close + 2..].find(')')?;
        Some((&text[1..close], &text[close + 2 + after_target + 1..]))
    }

    fn without_emphasis(text: &str) -> String {
        let unmarked = EMPHASIS_MARKS
            .iter()
            .fold(text.to_owned(), |text, mark| text.replace(mark, ""));
        unmarked.replace('*', "")
    }
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use super::*;

    fn excerpt(body: &str) -> Option<String> {
        ArticleExcerpt::from_body(body).map(ArticleExcerpt::into_string)
    }

    #[test]
    fn skips_the_heading_and_drops_bold_marks() {
        assert_eq!(
            excerpt("# 寫作是修行\n娜妲莉說，**先寫**再說。"),
            Some("娜妲莉說，先寫再說。".to_owned())
        );
    }

    #[test]
    fn drops_quote_list_and_task_marks_and_joins_lines_with_a_space() {
        assert_eq!(
            excerpt("> 手不要停。\n- 不要刪\n- [x] 每天寫"),
            Some("手不要停。 不要刪 每天寫".to_owned())
        );
    }

    #[test]
    fn keeps_link_text_and_drops_backticks() {
        assert_eq!(
            excerpt("看 [Rust 官網](https://rust-lang.org) 的 `cargo` 說明"),
            Some("看 Rust 官網 的 cargo 說明".to_owned())
        );
    }

    #[test]
    fn keeps_exactly_120_characters_whole() {
        let body = "字".repeat(120);

        assert_eq!(excerpt(&body), Some(body));
    }

    #[test]
    fn cuts_121_characters_to_120_and_an_ellipsis() {
        let body = "字".repeat(121);

        assert_eq!(excerpt(&body), Some(format!("{}…", "字".repeat(120))));
    }

    #[rstest]
    #[case::empty_body("")]
    #[case::only_blank_lines("\n  \n")]
    #[case::heading_and_image("# 標題\n![圖](images/a.png)")]
    #[case::only_a_thematic_break("---\n* * *")]
    fn has_no_excerpt_without_readable_text(#[case] body: &str) {
        assert_eq!(excerpt(body), None);
    }

    #[test]
    fn skips_a_code_block_at_the_start() {
        assert_eq!(
            excerpt("```rust\nfn main() {}\n```\n結論在這裡"),
            Some("結論在這裡".to_owned())
        );
    }

    #[test]
    fn skips_a_tilde_code_block_too() {
        assert_eq!(excerpt("~~~\ncode\n~~~\n文字"), Some("文字".to_owned()));
    }

    #[rstest]
    #[case::ordered_list("1. 第一\n2) 第二", "第一 第二")]
    #[case::plus_list("+ 項目", "項目")]
    #[case::nested_quote_and_list("> - [ ] 待辦", "待辦")]
    #[case::strikethrough_and_italics("~~刪~~ *斜* __粗__", "刪 斜 粗")]
    #[case::image_inside_a_line("前![圖](a.png)後", "前後")]
    #[case::bracket_that_is_not_a_link("[不是連結] 文字", "[不是連結] 文字")]
    #[case::hashtag_is_not_a_heading("#標籤 文字", "#標籤 文字")]
    #[case::number_without_list_mark("2026 年", "2026 年")]
    #[case::runs_of_spaces("很多    空白", "很多 空白")]
    fn reads_like_text(#[case] body: &str, #[case] expected: &str) {
        assert_eq!(excerpt(body), Some(expected.to_owned()));
    }
}
