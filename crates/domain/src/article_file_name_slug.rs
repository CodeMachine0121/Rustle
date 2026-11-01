use std::collections::HashSet;

use crate::vault_name::ArticleFileName;

const ILLEGAL_FILE_NAME_CHARACTERS: [char; 9] = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
const FALLBACK_SLUG: &str = "untitled";
const ARTICLE_EXTENSION: &str = ".md";

/// The file name stem an article title turns into: lowercase, words joined
/// by `-`, characters file systems reject removed, non-ASCII kept.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleFileNameSlug(String);

impl ArticleFileNameSlug {
    pub fn from_title(title: &str) -> Self {
        let hyphenated = title
            .to_lowercase()
            .split_whitespace()
            .collect::<Vec<_>>()
            .join("-");
        let legal: String = hyphenated
            .chars()
            .filter(|character| {
                !ILLEGAL_FILE_NAME_CHARACTERS.contains(character) && !character.is_control()
            })
            .collect();
        let slug = legal
            .split('-')
            .filter(|part| !part.is_empty())
            .collect::<Vec<_>>()
            .join("-");
        if slug.is_empty() {
            Self(FALLBACK_SLUG.to_owned())
        } else {
            Self(slug)
        }
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }

    /// The first of `slug.md`, `slug-2.md`, `slug-3.md`… that no existing
    /// file name takes, compared case-insensitively like macOS and Windows.
    pub fn available_file_name<'a>(
        &self,
        existing_file_names: impl IntoIterator<Item = &'a str>,
    ) -> ArticleFileName {
        let taken: HashSet<String> = existing_file_names
            .into_iter()
            .map(str::to_lowercase)
            .collect();
        let candidates = std::iter::once(format!("{}{ARTICLE_EXTENSION}", self.0))
            .chain((2_u64..).map(|number| format!("{}-{number}{ARTICLE_EXTENSION}", self.0)));
        let free = candidates
            .into_iter()
            .find(|candidate| !taken.contains(&candidate.to_lowercase()))
            .expect("an endless list of candidates always has a free one");
        ArticleFileName::parse(&free).expect("a slug never contains a path separator")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    fn file_name_for(title: &str, existing: &[&str]) -> String {
        ArticleFileNameSlug::from_title(title)
            .available_file_name(existing.iter().copied())
            .to_string()
    }

    #[rstest]
    #[case::lowercase_and_hyphens("Zen of Writing", "zen-of-writing.md")]
    #[case::keeps_non_ascii("Tauri 與 Electron 的取捨", "tauri-與-electron-的取捨.md")]
    #[case::drops_illegal_characters("A/B 測試: 第一輪", "ab-測試-第一輪.md")]
    #[case::collapses_whitespace("  好多   空白  ", "好多-空白.md")]
    #[case::collapses_and_trims_hyphens("前後 -- 破折號 --", "前後-破折號.md")]
    #[case::drops_every_reserved_character("a\\b*c?d\"e<f>g|h", "abcdefgh.md")]
    #[case::drops_control_characters("tab\u{7}bell", "tabbell.md")]
    #[case::nothing_left("///", "untitled.md")]
    #[case::empty("", "untitled.md")]
    fn turns_a_title_into_a_file_name(#[case] title: &str, #[case] expected: &str) {
        assert_eq!(file_name_for(title, &[]), expected);
    }

    #[test]
    fn numbers_a_name_that_is_taken() {
        assert_eq!(
            file_name_for("Zen of Writing", &["zen-of-writing.md"]),
            "zen-of-writing-2.md"
        );
    }

    #[test]
    fn keeps_counting_until_a_name_is_free() {
        assert_eq!(
            file_name_for(
                "Zen of Writing",
                &["zen-of-writing.md", "zen-of-writing-2.md"]
            ),
            "zen-of-writing-3.md"
        );
    }

    #[test]
    fn compares_taken_names_case_insensitively() {
        assert_eq!(
            file_name_for("Zen of Writing", &["ZEN-OF-WRITING.md"]),
            "zen-of-writing-2.md"
        );
    }

    #[test]
    fn exposes_the_slug_text() {
        assert_eq!(
            ArticleFileNameSlug::from_title("Zen of Writing").as_str(),
            "zen-of-writing"
        );
    }
}
