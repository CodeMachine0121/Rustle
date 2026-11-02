const CHARACTER_LIMIT: usize = 120;
const ELLIPSIS: char = '…';
const PAIRED_MARKS: [&str; 2] = ["~~", "`"];
const EDGE_MARKS: [char; 2] = ['*', '_'];
const CODE_FENCES: [&str; 2] = ["```", "~~~"];
const TASK_BOXES: [&str; 3] = ["[ ] ", "[x] ", "[X] "];

/// The opening words of an article's body as a reader sees them: headings,
/// images, code blocks and Markdown marks left out, lines joined by a single
/// space, at most 120 characters before an ellipsis.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleExcerpt(String);

impl ArticleExcerpt {
    /// `None` when the body holds no readable text.
    pub fn from_body(body: &str) -> Option<Self> {
        let lines: Vec<&str> = body.lines().map(str::trim).collect();
        let mut words = String::new();
        let mut open_fence: Option<&str> = None;
        let mut index = 0;
        while index < lines.len() {
            let line = lines[index];
            index += 1;
            if let Some(fence) = CODE_FENCES.iter().find(|fence| line.starts_with(**fence)) {
                open_fence = match open_fence {
                    None => Some(fence),
                    Some(open) if open == *fence => None,
                    still_open => still_open,
                };
                continue;
            }
            if open_fence.is_some() || Self::is_heading(line) || Self::is_thematic_break(line) {
                continue;
            }
            if lines
                .get(index)
                .is_some_and(|next| Self::is_setext_underline(next))
            {
                index += 1;
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

    /// The `===` or `---` line that turns the line above it into a heading.
    fn is_setext_underline(line: &str) -> bool {
        !line.is_empty() && (line.chars().all(|c| c == '=') || line.chars().all(|c| c == '-'))
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

    /// Images disappear, links keep their text, emphasis and code marks go.
    fn readable_text(line: &str) -> String {
        let without_images = Self::replaced_brackets(line, "![", false);
        let with_link_labels = Self::replaced_brackets(&without_images, "[", true);
        Self::without_emphasis(&with_link_labels)
    }

    /// Every `opener label](target)` in `line`, replaced by its label or by nothing.
    fn replaced_brackets(line: &str, opener: &str, keeps_label: bool) -> String {
        let mut text = String::new();
        let mut rest = line;
        while let Some(open) = rest.find(opener) {
            text.push_str(&rest[..open]);
            let bracket = open + opener.len() - 1;
            match Self::link_parts(&rest[bracket..]) {
                Some((label, after)) => {
                    if keeps_label {
                        text.push_str(label);
                    }
                    rest = after;
                }
                None => {
                    text.push_str(&rest[open..=bracket]);
                    rest = &rest[bracket + 1..];
                }
            }
        }
        text.push_str(rest);
        text
    }

    /// `[label](target)rest` → `(label, rest)`; a `]` not followed by `(` is no link.
    fn link_parts(text: &str) -> Option<(&str, &str)> {
        let close = text.find(']')?;
        let target = text[close + 1..].strip_prefix('(')?;
        let target_end = target.find(')')?;
        Some((&text[1..close], &target[target_end + 1..]))
    }

    fn without_emphasis(text: &str) -> String {
        let unpaired = PAIRED_MARKS
            .iter()
            .fold(text.to_owned(), |text, mark| text.replace(mark, ""));
        Self::without_edge_marks(&unpaired)
    }

    /// `*斜*`, `**粗**` and `_italic_` lose their marks; `2*3` and `snake_case` keep theirs.
    fn without_edge_marks(text: &str) -> String {
        let characters: Vec<char> = text.chars().collect();
        let is_letter_at = |index: Option<usize>| {
            index
                .and_then(|index| characters.get(index))
                .is_some_and(|c| c.is_alphanumeric())
        };
        characters
            .iter()
            .enumerate()
            .filter(|&(index, character)| {
                !EDGE_MARKS.contains(character)
                    || (is_letter_at(index.checked_sub(1)) && is_letter_at(Some(index + 1)))
            })
            .map(|(_, character)| character)
            .collect()
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
    fn keeps_a_code_block_open_until_its_own_fence_closes_it() {
        assert_eq!(
            excerpt("```\n~~~\n程式\n```\n文字"),
            Some("文字".to_owned())
        );
    }

    #[rstest]
    #[case::equals_underline("標題\n===\n正文")]
    #[case::dash_underline("標題\n---\n正文")]
    fn skips_a_heading_underlined_below_it(#[case] body: &str) {
        assert_eq!(excerpt(body), Some("正文".to_owned()));
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
    #[case::underscore_italics("_斜體_ 與 _italic_", "斜體 與 italic")]
    #[case::underscore_inside_a_name("snake_case 名字", "snake_case 名字")]
    #[case::multiplication("2*3=6", "2*3=6")]
    #[case::image_inside_a_link("[![徽章](a.png)](b) 文字", "文字")]
    #[case::reference_link_before_an_inline_link("[a][1] 與 [b](c)", "[a][1] 與 b")]
    #[case::image_inside_a_line("前![圖](a.png)後", "前後")]
    #[case::bracket_that_is_not_a_link("[不是連結] 文字", "[不是連結] 文字")]
    #[case::hashtag_is_not_a_heading("#標籤 文字", "#標籤 文字")]
    #[case::number_without_list_mark("2026 年", "2026 年")]
    #[case::runs_of_spaces("很多    空白", "很多 空白")]
    fn reads_like_text(#[case] body: &str, #[case] expected: &str) {
        assert_eq!(excerpt(body), Some(expected.to_owned()));
    }
}
