use std::collections::HashSet;

use thiserror::Error;

use crate::article_document::{ArticleDocument, UneditableFrontMatter};
use crate::article_file_name_slug::ArticleFileNameSlug;
use crate::article_status::ArticleStatus;
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
/// is not blank, at most one status, and tags without surrounding spaces,
/// blanks or repeats.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleDraft {
    title: String,
    status: Option<ArticleStatus>,
    tags: Vec<String>,
}

impl ArticleDraft {
    pub fn new(
        title: &str,
        status: Option<ArticleStatus>,
        tags: &[String],
    ) -> Result<Self, ArticleDraftError> {
        let title = title.trim();
        if title.is_empty() {
            return Err(ArticleDraftError::BlankTitle);
        }
        let mut seen = HashSet::new();
        let tags = tags
            .iter()
            .map(|tag| tag.trim())
            .filter(|tag| !tag.is_empty() && seen.insert(*tag))
            .map(str::to_owned)
            .collect();
        Ok(Self {
            title: title.to_owned(),
            status,
            tags,
        })
    }

    pub fn title(&self) -> &str {
        &self.title
    }

    pub fn status(&self) -> Option<ArticleStatus> {
        self.status
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
        let mut update = MetadataUpdate::default()
            .title(self.title.as_str())
            .created_at(created_at.as_str())
            .updated_at(created_at);
        if let Some(status) = self.status {
            update = update.status(status);
        }
        ArticleDocument::parse("")
            .with_metadata(&update.tags(self.tags.iter().cloned()))
            .to_text()
    }

    /// Writes the title, status and tags into `document`, last updated at
    /// `updated_at`; every other byte of the file stays as it was. Without a
    /// status, only a recognised status line is removed: one Rustle cannot
    /// read was never shown, so it was never asked to go.
    pub fn edit(
        &self,
        document: ArticleDocument,
        updated_at: LocalTimestamp,
    ) -> Result<ArticleDocument, UneditableFrontMatter> {
        let mut update = MetadataUpdate::default()
            .title(self.title.as_str())
            .updated_at(updated_at.to_string())
            .tags(self.tags.iter().cloned());
        match (self.status, document.status()) {
            (Some(status), _) => update = update.status(status),
            (None, Some(_)) => update = update.without_status(),
            (None, None) => {}
        }
        document.edit_metadata(&update)
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

    fn draft(title: &str, status: Option<ArticleStatus>, tags: &[&str]) -> ArticleDraft {
        ArticleDraft::new(title, status, &strings(tags)).expect("valid draft")
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
            ArticleDraft::new(title, None, &[]),
            Err(ArticleDraftError::BlankTitle)
        );
    }

    #[test]
    fn trims_the_title() {
        assert_eq!(
            draft("  Zen of Writing  ", None, &[]).title(),
            "Zen of Writing"
        );
    }

    #[test]
    fn trims_drops_blank_and_repeated_tags() {
        let draft = draft("Zen", None, &["electron", " ", "Electron", "electron "]);

        assert_eq!(draft.tags(), ["electron", "Electron"]);
    }

    #[test]
    fn writes_the_front_matter_and_no_body() {
        let text = draft(
            "Tauri 與 Electron 的取捨",
            Some(ArticleStatus::Active),
            &["tauri", "electron"],
        )
        .to_text(created_at());

        assert_eq!(
            text,
            "---\n\
             title: Tauri 與 Electron 的取捨\n\
             created_at: 2026-08-20T14:32:05+00:00\n\
             updated_at: 2026-08-20T14:32:05+00:00\n\
             status: active\n\
             tags:\n  - tauri\n  - electron\n\
             ---\n"
        );
    }

    #[test]
    fn leaves_out_a_missing_status_and_empty_tags() {
        let text = draft("Zen of Writing", None, &[]).to_text(created_at());

        assert_eq!(
            text,
            "---\n\
             title: Zen of Writing\n\
             created_at: 2026-08-20T14:32:05+00:00\n\
             updated_at: 2026-08-20T14:32:05+00:00\n\
             ---\n"
        );
    }

    #[rstest]
    #[case(None)]
    #[case(Some(ArticleStatus::OnHold))]
    fn reads_back_as_the_metadata_it_was_written_with(#[case] status: Option<ArticleStatus>) {
        let draft = draft("Zen: of Writing", status, &["yes"]);
        let file_name = ArticleFileName::parse("zen-of-writing.md").expect("valid name");

        let metadata = ArticleDocument::parse(&draft.to_text(created_at())).metadata(&file_name);

        assert_eq!(metadata.title, "Zen: of Writing");
        assert_eq!(metadata.created_at, "2026-08-20T14:32:05+00:00");
        assert_eq!(metadata.updated_at, "2026-08-20T14:32:05+00:00");
        assert_eq!(metadata.status, status);
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
            draft(title, None, &[]).file_name(&entries).as_str(),
            expected
        );
    }

    const ANNOTATED: &str = "---\r\n\
        # 這一行是使用者自己寫的註解\r\n\
        title: 舊標題\r\n\
        draft: true\r\n\
        created_at: 2026-08-20T14:32:05+08:00\r\n\
        updated_at: 2026-08-20T16:04:11+08:00\r\n\
        category:\r\n  - 技術筆記\r\n  - 桌面開發\r\n\
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
    fn editing_changes_only_title_status_tags_and_updated_at() {
        let text = edited(
            &draft("新標題", Some(ArticleStatus::Active), &["electron"]),
            ANNOTATED,
        );

        assert_eq!(
            text,
            "---\r\n\
             # 這一行是使用者自己寫的註解\r\n\
             title: 新標題\r\n\
             draft: true\r\n\
             created_at: 2026-08-20T14:32:05+08:00\r\n\
             updated_at: 2026-08-20T14:32:05+00:00\r\n\
             category:\r\n  - 技術筆記\r\n  - 桌面開發\r\n\
             tags:\r\n  - electron\r\n\
             status: active\r\n\
             ---\r\n\
             \r\n正文第一行。\r\n"
        );
    }

    #[test]
    fn editing_replaces_the_status() {
        let text = edited(
            &draft("Zen", Some(ArticleStatus::Completed), &[]),
            "---\ntitle: Zen\nstatus: active\n---\n正文\n",
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nstatus: completed\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n正文\n"
        );
    }

    #[test]
    fn editing_without_a_status_removes_a_recognised_one() {
        let text = edited(
            &draft("Zen", None, &[]),
            "---\ntitle: Zen\nstatus: Active\n---\n正文\n",
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n正文\n"
        );
    }

    #[test]
    fn editing_without_a_status_keeps_an_unrecognised_one() {
        let text = edited(
            &draft("Zen", None, &[]),
            "---\ntitle: Zen\nstatus: 進行中\n---\n正文\n",
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nstatus: 進行中\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n正文\n"
        );
    }

    #[test]
    fn choosing_a_status_replaces_an_unrecognised_one() {
        let text = edited(
            &draft("Zen", Some(ArticleStatus::Active), &[]),
            "---\ntitle: Zen\nstatus: 進行中\n---\n正文\n",
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nstatus: active\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n正文\n"
        );
    }

    #[test]
    fn editing_without_tags_removes_the_tags_key() {
        let text = edited(
            &draft("Zen", None, &[]),
            "---\ntitle: Zen\ntags:\n  - electron\n---\n正文\n",
        );

        assert_eq!(
            text,
            "---\ntitle: Zen\nupdated_at: 2026-08-20T14:32:05+00:00\n---\n正文\n"
        );
    }

    #[test]
    fn editing_keeps_the_byte_order_mark() {
        let text = edited(
            &draft("Zen", None, &[]),
            "\u{feff}---\ntitle: Old\n---\n正文\n",
        );

        assert!(text.starts_with("\u{feff}---\ntitle: Zen\n"));
    }

    #[test]
    fn editing_refuses_a_front_matter_it_cannot_edit() {
        let broken = ArticleDocument::parse("---\ntitle: Zen\n  broken: indentation\n---\n");

        assert_eq!(
            draft("Zen", None, &[]).edit(broken, created_at()),
            Err(UneditableFrontMatter)
        );
    }
}
