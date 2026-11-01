use crate::vault_name::{ArticleFileName, WorkspaceName};
use crate::vault_scope::IMAGES_FOLDER_NAME;

const ARTICLE_EXTENSION: &str = ".md";
const HIDDEN_NAME_PREFIX: char = '.';

/// What a folder entry is, judged by what it points to when it is a link.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VaultEntryKind {
    Folder,
    File,
    /// A link that leads out of the vault or nowhere, or anything that is
    /// neither a folder nor a file. It still occupies its name.
    Unreachable,
}

/// One item found directly inside the vault or a workspace folder.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultEntry {
    name: String,
    kind: VaultEntryKind,
}

impl VaultEntry {
    pub fn new(name: impl Into<String>, kind: VaultEntryKind) -> Self {
        Self {
            name: name.into(),
            kind,
        }
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    /// A folder whose name is neither hidden nor reserved.
    pub fn as_workspace(&self) -> Option<WorkspaceName> {
        let is_listable = self.kind == VaultEntryKind::Folder
            && !Self::is_hidden(&self.name)
            && !Self::is_reserved(&self.name);
        is_listable
            .then(|| WorkspaceName::parse(&self.name).ok())
            .flatten()
    }

    /// A file with a `.md` extension in any case and a name before it.
    pub fn as_article(&self) -> Option<ArticleFileName> {
        let is_listable =
            self.kind == VaultEntryKind::File && Self::has_article_extension(&self.name);
        is_listable
            .then(|| ArticleFileName::parse(&self.name).ok())
            .flatten()
    }

    /// The file system would treat the two names as the same entry.
    pub fn clashes_with(&self, name: &str) -> bool {
        self.name.to_lowercase() == name.to_lowercase()
    }

    pub(crate) fn is_hidden(name: &str) -> bool {
        name.starts_with(HIDDEN_NAME_PREFIX)
    }

    pub(crate) fn is_reserved(name: &str) -> bool {
        name.eq_ignore_ascii_case(IMAGES_FOLDER_NAME)
    }

    fn has_article_extension(name: &str) -> bool {
        let extension_start = name.len().saturating_sub(ARTICLE_EXTENSION.len());
        name.len() > ARTICLE_EXTENSION.len()
            && name
                .get(extension_start..)
                .is_some_and(|extension| extension.eq_ignore_ascii_case(ARTICLE_EXTENSION))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    fn folder(name: &str) -> VaultEntry {
        VaultEntry::new(name, VaultEntryKind::Folder)
    }

    fn file(name: &str) -> VaultEntry {
        VaultEntry::new(name, VaultEntryKind::File)
    }

    #[rstest]
    #[case("Blog")]
    #[case("Reading-Notes")]
    #[case("讀書筆記")]
    #[case("notes.md")]
    fn a_plain_folder_is_a_workspace(#[case] name: &str) {
        assert_eq!(
            folder(name)
                .as_workspace()
                .map(|workspace| workspace.to_string()),
            Some(name.to_owned())
        );
    }

    #[rstest]
    #[case(".rustle")]
    #[case(".git")]
    #[case("images")]
    #[case("Images")]
    #[case("IMAGES")]
    fn a_hidden_or_reserved_folder_is_not_a_workspace(#[case] name: &str) {
        assert_eq!(folder(name).as_workspace(), None);
    }

    #[rstest]
    #[case(file("README.txt"))]
    #[case(file("Blog.md"))]
    #[case(VaultEntry::new("Escaping", VaultEntryKind::Unreachable))]
    fn anything_but_a_folder_is_not_a_workspace(#[case] entry: VaultEntry) {
        assert_eq!(entry.as_workspace(), None);
    }

    #[rstest]
    #[case("zen-of-writing.md")]
    #[case("TAURI-VS-ELECTRON.MD")]
    #[case("Mixed.Md")]
    #[case("寫作.md")]
    fn a_file_ending_in_md_is_an_article(#[case] name: &str) {
        assert_eq!(
            file(name).as_article().map(|article| article.to_string()),
            Some(name.to_owned())
        );
    }

    #[rstest]
    #[case(file("README.txt"))]
    #[case(file(".DS_Store"))]
    #[case(file(".md"))]
    #[case(file("notes.markdown"))]
    #[case(file("md"))]
    #[case(folder("notes.md"))]
    #[case(folder("images"))]
    #[case(VaultEntry::new("link-outside.md", VaultEntryKind::Unreachable))]
    fn anything_else_is_not_an_article(#[case] entry: VaultEntry) {
        assert_eq!(entry.as_article(), None);
    }

    #[rstest]
    #[case("Blog", "blog", true)]
    #[case("README.txt", "readme.TXT", true)]
    #[case("Blog", "Blog2", false)]
    #[case("Ärger", "ärger", true)]
    fn compares_names_the_way_the_file_system_does(
        #[case] existing: &str,
        #[case] requested: &str,
        #[case] clashes: bool,
    ) {
        assert_eq!(folder(existing).clashes_with(requested), clashes);
    }
}
