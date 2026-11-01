use std::collections::HashSet;

use thiserror::Error;

use crate::article_document::{ArticleDocument, UneditableFrontMatter};
use crate::article_file_name_slug::ArticleFileNameSlug;
use crate::local_timestamp::LocalTimestamp;
use crate::metadata_update::MetadataUpdate;
use crate::vault_entry::VaultEntry;
use crate::vault_name::ArticleFileName;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum ArticleDraftError {
    #[error("an article needs a title")]
    BlankTitle,
}

/// An article's metadata as typed into the create or edit form: a title that
/// is not blank, and categories and tags without surrounding spaces, blanks
/// or repeats.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleDraft {
    title: String,
    category: Vec<String>,
    tags: Vec<String>,
}

impl ArticleDraft {
    pub fn new(
        title: &str,
        category: &[String],
        tags: &[String],
    ) -> Result<Self, ArticleDraftError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(ArticleDraftError::BlankTitle);
        }
        let distinct_values = |values: &[String]| {
            let mut seen = HashSet::new();
            values
                .iter()
                .map(|value| value.trim())
                .filter(|value| !value.is_empty() && seen.insert(*value))
                .map(str::to_owned)
                .collect()
        };
        Ok(Self {
            title: title.to_owned(),
            category: distinct_values(category),
            tags: distinct_values(tags),
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn category(&self) -> &[String] {
        &self.category
    }

    pub fn tags(&self) -> &[String] {
        &self.tags
    }

    /// The title's file name, numbered past every name already in the
    /// folder, articles or not.
    pub fn file_name(&self, folder_entries: &[VaultEntry]) -> ArticleFileName {
        ArticleFileNameSlug::from_title(&self.title)
            .available_file_name(folder_entries.iter().map(VaultEntry::name))
    }

    /// The whole file: a front matter created and last updated at
    /// `created_at`, and an empty body.
    pub fn to_text(&self, created_at: LocalTimestamp) -> String {
        let created_at = created_at.to_string();
        let update = self
            .metadata_update()
            .created_at(created_at.as_str())
            .updated_at(created_at);
        ArticleDocument::parse("").with_metadata(&update).to_text()
    }

    /// Writes the title, categories and tags into `document`, last updated
    /// at `updated_at`; every other byte of the file stays as it was.
    pub fn edit(
        &self,
        document: ArticleDocument,
        updated_at: LocalTimestamp,
    ) -> Result<ArticleDocument, UneditableFrontMatter> {
        document.edit_metadata(&self.metadata_update().updated_at(updated_at.to_string()))
    }

    fn metadata_update(&self) -> MetadataUpdate {
        MetadataUpdate::default()
            .title(self.title.as_str())
            .category(self.category.iter().cloned())
            .tags(self.tags.iter().cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault_entry::VaultEntryKind;
    use rstest::rstest;
    use std::time::{Duration, UNIX_EPOCH};

    fn strings(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| (*value).to_owned()).collect()
    }

    fn draft(title: &str, category: &[&str], tags: &[&str]) -> ArticleDraft {
        ArticleDraft::new(title, &strings(category), &strings(tags)).expect("valid draft")
    }

    fn created_at() -> LocalTimestamp {
        LocalTimestamp::new(UNIX_EPOCH + Duration::from_secs(1_787_236_325), 0)
    }

    #[rstest]
    #[case("")]
    #[case("   ")]
    #[case("\t\n")]
    fn refuses_a_blank_title(#[case] title: &str) {
        assert_eq!(
            ArticleDraft::new(title, &[], &[]),
            Err(ArticleDraftError::BlankTitle)
        );
    }

    #[test]
    fn trims_the_title() {
        assert_eq!(
            draft("  Zen of Writing  ", &[], &[]).title(),
            "Zen of Writing"
        );
    }

    #[test]
    fn trims_drops_blank_and_repeated_categories_and_tags() {
        let draft = draft(
            "Zen",
            &["  技術筆記  ", "", "技術筆記", "桌面開發"],
            &["electron", " ", "Electron", "electron "],
        );

        assert_eq!(draft.category(), ["技術筆記", "桌面開發"]);
        assert_eq!(draft.tags(), ["electron", "Electron"]);
    }

    #[test]
    fn writes_the_front_matter_and_no_body() {
        let text = draft(
            "Tauri 與 Electron 的取捨",
            &["技術筆記", "桌面開發"],
            &["tauri", "electron"],
        )
        .to_text(created_at());

        assert_eq!(
            text,
            "---\n\
             title: Tauri 與 Electron 的取捨\n\
             created_at: 2026-08-20T14:32:05+00:00\n\
             updated_at: 2026-08-20T14:32:05+00:00\n\
             category:\n  - 技術筆記\n  - 桌面開發\n\
             tags:\n  - tauri\n  - electron\n\
             ---\n"
        );
    }

    #[test]
    fn leaves_out_empty_category_and_tags() {
        let text = draft("Zen of Writing", &[], &[]).to_text(created_at());

        assert_eq!(
            text,
            "---\n\
             title: Zen of Writing\n\
             created_at: 2026-08-20T14:32:05+00:00\n\
             updated_at: 2026-08-20T14:32:05+00:00\n\
             ---\n"
        );
    }

    #[test]
    fn reads_back_as_the_metadata_it_was_written_with() {
        let draft = draft("Zen: of Writing", &["技術筆記"], &["yes"]);
        let file_name = ArticleFileName::parse("zen-of-writing.md").expect("valid name");

        let metadata = ArticleDocument::parse(&draft.to_text(created_at())).metadata(&file_name);

        assert_eq!(metadata.title, "Zen: of Writing");
        assert_eq!(metadata.created_at, "2026-08-20T14:32:05+00:00");
        assert_eq!(metadata.updated_at, "2026-08-20T14:32:05+00:00");
        assert_eq!(metadata.category, ["技術筆記"]);
        assert_eq!(metadata.tags, ["yes"]);
        assert!(!metadata.has_incomplete_metadata);
    }

    #[rstest]
    #[case::empty_folder("Zen of Writing", &[], "zen-of-writing.md")]
    #[case::keeps_chinese("Tauri 與 Electron 的取捨", &[], "tauri-與-electron-的取捨.md")]
    #[case::numbers_a_taken_name("Zen of Writing", &[("zen-of-writing.md", VaultEntryKind::File)], "zen-of-writing-2.md")]
    #[case::a_folder_takes_a_name_too("Notes", &[("notes.md", VaultEntryKind::Folder)], "notes-2.md")]
    #[case::an_unreachable_entry_takes_a_name_too("Notes", &[("NOTES.md", VaultEntryKind::Unreachable)], "notes-2.md")]
    fn names_the_file_after_the_title_among_every_name_in_the_folder(
        #[case] title: &str,
        #[case] entries: &[(&str, VaultEntryKind)],
        #[case] expected: &str,
    ) {
        let entries: Vec<VaultEntry> = entries
            .iter()
            .map(|(name, kind)| VaultEntry::new(*name, *kind))
            .collect();

        assert_eq!(
            draft(title, &[], &[]).file_name(&entries).as_str(),
            expected
        );
    }

    const ANNOTATED: &str = "---\r\n\
        # 這一行是使用者自己寫的註解\r\n\
        title: 舊標題\r\n\
        draft: true\r\n\
        created_at: 2026-08-20T14:32:05+08:00\r\n\
        updated_at: 2026-08-20T16:04:11+08:00\r\n\
        tags:\r\n  - electron\r\n\
        ---\r\n\
        \r\n正文第一行。\r\n";

    fn edited(draft: &ArticleDraft, text: &str) -> String {
        draft
            .edit(ArticleDocument::parse(text), created_at())
            .expect("an editable front matter")
            .to_text()
    }

    #[test]
    fn editing_changes_only_title_category_tags_and_updated_at() {
        let text = edited(&draft("新標題", &["技術筆記"], &["electron"]), ANNOTATED);

        assert_eq!(
            text,
            "---\r\n\
             # 這一行是使用者自己寫的註解\r\n\
             title: 新標題\r\n\
             draft: true\r\n\
             created_at: 2026-08-20T14:32:05+08:00\r\n\
             updated_at: 2026-08-20T14:32:05+00:00\r\n\
             tags:\r\n  - electron\r\n\
             category:\r\n  - 技術筆記\r\n\
             ---\r\n\
             \r\n正文第一行。\r\n"
        );
    }

    #[test]
    fn editing_without_categories_removes_the_category_key() {
        let text = edited(
            &draft("Zen", &[], &[]),
            "---\ntitle: Zen\ncategory:\n  - 技術筆記\n---\n正文\n",
        );

        assert!(!text.contains("category"));
        assert!(text.ends_with("---\n正文\n"));
    }

    #[test]
    fn editing_keeps_the_byte_order_mark() {
        let text = edited(
            &draft("Zen", &[], &[]),
            "\u{feff}---\ntitle: Old\n---\n正文\n",
        );

        assert!(text.starts_with("\u{feff}---\ntitle: Zen\n"));
    }

    #[test]
    fn editing_refuses_a_front_matter_it_cannot_edit() {
        let broken = ArticleDocument::parse("---\ntitle: Zen\n  broken: indentation\n---\n");

        assert_eq!(
            draft("Zen", &[], &[]).edit(broken, created_at()),
            Err(UneditableFrontMatter)
        );
    }
}
