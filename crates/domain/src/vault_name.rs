use std::fmt;
use std::path::{Component, Path};

use thiserror::Error;

#[derive(Debug, Clone, PartialEq, Eq, Error)]
pub enum VaultPathError {
    #[error("'{rejected}' is outside the vault")]
    OutsideVault { rejected: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
struct PathSegment(String);

impl PathSegment {
    fn parse(name: &str) -> Result<Self, VaultPathError> {
        if Self::is_single_plain_segment(name) {
            Ok(Self(name.to_owned()))
        } else {
            Err(VaultPathError::OutsideVault {
                rejected: name.to_owned(),
            })
        }
    }

    fn is_single_plain_segment(name: &str) -> bool {
        let has_forbidden_character = name.contains(['/', '\\', '\0']);
        let mut components = Path::new(name).components();
        let is_one_normal_component = matches!(
            (components.next(), components.next()),
            (Some(Component::Normal(_)), None)
        );
        !name.trim().is_empty() && !has_forbidden_character && is_one_normal_component
    }
}

macro_rules! vault_name {
    ($(#[$meta:meta])* $name:ident) => {
        $(#[$meta])*
        #[derive(Debug, Clone, PartialEq, Eq, Hash)]
        pub struct $name(PathSegment);

        impl $name {
            pub fn parse(name: &str) -> Result<Self, VaultPathError> {
                PathSegment::parse(name).map(Self)
            }

            pub fn as_str(&self) -> &str {
                &self.0 .0
            }
        }

        impl fmt::Display for $name {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str(self.as_str())
            }
        }
    };
}

vault_name!(
    /// A workspace folder directly under the vault root.
    WorkspaceName
);
vault_name!(
    /// An article file directly inside a workspace folder.
    ArticleFileName
);
vault_name!(
    /// An image file directly inside a workspace's images folder.
    ImageFileName
);

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case("Blog")]
    #[case("讀書筆記")]
    #[case("zen-of-writing.md")]
    #[case(".hidden-but-plain")]
    fn accepts_a_single_plain_name(#[case] name: &str) {
        assert_eq!(
            WorkspaceName::parse(name).map(|parsed| parsed.to_string()),
            Ok(name.to_owned())
        );
    }

    #[rstest]
    #[case("..")]
    #[case("../..")]
    #[case("../Other")]
    #[case("/etc")]
    #[case("Blog/2026")]
    #[case("Blog\\2026")]
    #[case(".")]
    #[case("")]
    #[case("   ")]
    fn rejects_workspace_names_that_are_not_one_plain_folder(#[case] name: &str) {
        assert_eq!(
            WorkspaceName::parse(name),
            Err(VaultPathError::OutsideVault {
                rejected: name.to_owned()
            })
        );
    }

    #[rstest]
    #[case("../secret.md")]
    #[case("../../../etc/passwd")]
    #[case("/etc/passwd")]
    #[case("sub/nested.md")]
    #[case("")]
    fn rejects_article_file_names_that_escape_the_workspace(#[case] name: &str) {
        assert_eq!(
            ArticleFileName::parse(name),
            Err(VaultPathError::OutsideVault {
                rejected: name.to_owned()
            })
        );
    }

    #[rstest]
    #[case("../../evil.png")]
    #[case("../x.png")]
    fn rejects_image_file_names_that_escape_the_images_folder(#[case] name: &str) {
        assert_eq!(
            ImageFileName::parse(name),
            Err(VaultPathError::OutsideVault {
                rejected: name.to_owned()
            })
        );
    }

    #[test]
    fn rejection_message_names_the_rejected_input() {
        let error = WorkspaceName::parse("..").expect_err("'..' must be rejected");

        assert!(error.to_string().contains(".."));
    }
}
