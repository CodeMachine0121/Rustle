/// How many body lines one search lists at most; more than this is reported, not listed.
pub const BODY_MATCH_LIMIT: usize = 200;

/// What the writer typed to look for: one contiguous piece of text, any
/// case. Blank text is not something to look for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SearchText {
    lowercase: String,
}

/// One body line that holds the search text, numbered from 1 like the editor's lines.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BodyLine {
    pub number: usize,
    pub text: String,
}

impl SearchText {
    pub fn parse(typed: &str) -> Option<Self> {
        let trimmed = typed.trim();
        (!trimmed.is_empty()).then(|| Self {
            lowercase: trimmed.to_lowercase(),
        })
    }

    pub fn matching_lines<'a>(&'a self, body: &'a str) -> impl Iterator<Item = BodyLine> + 'a {
        body.lines()
            .enumerate()
            .filter(|(_, line)| line.to_lowercase().contains(&self.lowercase))
            .map(|(index, line)| BodyLine {
                number: index + 1,
                text: line.to_owned(),
            })
    }
}

#[cfg(test)]
mod tests {
    use rstest::rstest;

    use super::*;

    fn line_numbers(search: &str, body: &str) -> Vec<usize> {
        SearchText::parse(search)
            .expect("not blank")
            .matching_lines(body)
            .map(|line| line.number)
            .collect()
    }

    #[rstest]
    #[case("")]
    #[case("   ")]
    #[case("\t\n")]
    fn blank_text_is_nothing_to_look_for(#[case] typed: &str) {
        assert_eq!(SearchText::parse(typed), None);
    }

    #[test]
    fn numbers_lines_from_one_and_hands_over_the_line_as_written() {
        let body = "第一行\n第二行\n今天加班到很晚\n";

        let lines: Vec<BodyLine> = SearchText::parse("加班")
            .expect("not blank")
            .matching_lines(body)
            .collect();

        assert_eq!(
            lines,
            vec![BodyLine {
                number: 3,
                text: "今天加班到很晚".to_owned()
            }]
        );
    }

    #[test]
    fn every_line_with_the_text_is_its_own_hit_in_line_order() {
        let body = (1..=12)
            .map(|number| {
                if [3, 7, 12].contains(&number) {
                    "加班"
                } else {
                    "休息"
                }
            })
            .collect::<Vec<_>>()
            .join("\n");

        assert_eq!(line_numbers("加班", &body), vec![3, 7, 12]);
    }

    #[test]
    fn a_line_with_the_text_twice_is_one_hit() {
        assert_eq!(line_numbers("加班", "a\nb\nc\n加班又加班"), vec![4]);
    }

    #[rstest]
    #[case("input method", vec![1])]
    #[case("INPUT", vec![1])]
    #[case("  input method  ", vec![1])]
    #[case("inpmet", vec![])]
    #[case("method input", vec![])]
    fn matches_one_contiguous_piece_in_any_case(#[case] typed: &str, #[case] expected: Vec<usize>) {
        assert_eq!(line_numbers(typed, "使用 Input Method"), expected);
    }

    #[test]
    fn counts_a_leading_empty_line_like_the_editor_does() {
        assert_eq!(line_numbers("正文", "\n正文的第一行。\n"), vec![2]);
    }

    #[test]
    fn a_windows_line_ending_is_not_part_of_the_line() {
        let lines: Vec<BodyLine> = SearchText::parse("加班")
            .expect("not blank")
            .matching_lines("加班\r\n下班")
            .collect();

        assert_eq!(lines[0].text, "加班");
    }
}
