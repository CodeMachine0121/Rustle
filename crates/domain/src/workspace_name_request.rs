use serde::Serialize;

use crate::vault_entry::VaultEntry;
use crate::vault_name::WorkspaceName;

const PATH_SEPARATORS: [char; 2] = ['/', '\\'];

/// Why a typed name cannot become a new workspace.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceNameRejection {
    Empty,
    ContainsPathSeparator,
    Reserved,
    AlreadyUsed,
}

/// A name the user typed for a new workspace, not yet accepted.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WorkspaceNameRequest<'a> {
    typed: &'a str,
}

impl<'a> WorkspaceNameRequest<'a> {
    pub fn new(typed: &'a str) -> Self {
        Self { typed }
    }

    /// Accepts the name only if it would be listed as a workspace and no
    /// entry in `existing` already occupies it.
    pub fn judge(self, existing: &[VaultEntry]) -> Result<WorkspaceName, WorkspaceNameRejection> {
        let name = self.typed;
        if name.trim().is_empty() {
            return Err(WorkspaceNameRejection::Empty);
        }
        if name.contains(PATH_SEPARATORS) {
            return Err(WorkspaceNameRejection::ContainsPathSeparator);
        }
        if VaultEntry::is_hidden(name) || VaultEntry::is_reserved(name) {
            return Err(WorkspaceNameRejection::Reserved);
        }
        if existing.iter().any(|entry| entry.clashes_with(name)) {
            return Err(WorkspaceNameRejection::AlreadyUsed);
        }
        WorkspaceName::parse(name).map_err(|_| WorkspaceNameRejection::Reserved)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::vault_entry::VaultEntryKind;
    use rstest::rstest;

    fn vault() -> Vec<VaultEntry> {
        vec![
            VaultEntry::new("Blog", VaultEntryKind::Folder),
            VaultEntry::new("README.txt", VaultEntryKind::File),
            VaultEntry::new("Dangling", VaultEntryKind::Unreachable),
        ]
    }

    #[rstest]
    #[case("Notes")]
    #[case("讀書筆記")]
    #[case("Blog 2026")]
    fn accepts_a_free_plain_name(#[case] typed: &str) {
        assert_eq!(
            WorkspaceNameRequest::new(typed)
                .judge(&vault())
                .map(|name| name.to_string()),
            Ok(typed.to_owned())
        );
    }

    #[rstest]
    #[case("", WorkspaceNameRejection::Empty)]
    #[case("   ", WorkspaceNameRejection::Empty)]
    #[case("Blog/2026", WorkspaceNameRejection::ContainsPathSeparator)]
    #[case("Blog\\2026", WorkspaceNameRejection::ContainsPathSeparator)]
    #[case("images", WorkspaceNameRejection::Reserved)]
    #[case("Images", WorkspaceNameRejection::Reserved)]
    #[case(".hidden", WorkspaceNameRejection::Reserved)]
    #[case(".", WorkspaceNameRejection::Reserved)]
    #[case("..", WorkspaceNameRejection::Reserved)]
    #[case("Blog", WorkspaceNameRejection::AlreadyUsed)]
    #[case("blog", WorkspaceNameRejection::AlreadyUsed)]
    #[case("README.txt", WorkspaceNameRejection::AlreadyUsed)]
    #[case("dangling", WorkspaceNameRejection::AlreadyUsed)]
    fn rejects_a_name_and_says_why(#[case] typed: &str, #[case] reason: WorkspaceNameRejection) {
        assert_eq!(
            WorkspaceNameRequest::new(typed).judge(&vault()),
            Err(reason)
        );
    }

    #[test]
    fn a_name_with_a_null_character_is_not_a_folder_name() {
        assert!(WorkspaceNameRequest::new("bad\0name").judge(&[]).is_err());
    }
}
