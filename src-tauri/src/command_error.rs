use std::fmt;

use rustle_application::{
    CreateArticleError, DeleteArticleError, DeleteWorkspaceError, SaveClipboardImagesError,
    UpdateArticleMetadataError,
};
use rustle_domain::{
    ArticleRepositoryError, ImageAssetRepositoryError, SettingsError, TrashError, VaultPathError,
    WorkspaceRepositoryError,
};
use serde::Serialize;
use thiserror::Error;

use crate::channel::Channel;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum FailureReason {
    NotImplemented,
    OutsideVault,
    UnknownChannel,
    Unexpected,
}

/// The one failure shape that crosses into the webview.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Error)]
#[serde(rename_all = "camelCase")]
#[error("{message}")]
pub struct CommandError {
    reason: FailureReason,
    message: String,
}

impl CommandError {
    pub fn not_implemented(channel: Channel) -> Self {
        Self {
            reason: FailureReason::NotImplemented,
            message: format!("the {channel} channel is not implemented yet"),
        }
    }

    pub fn unknown_channel(command_name: &str) -> Self {
        Self {
            reason: FailureReason::UnknownChannel,
            message: format!("no channel answers '{command_name}'"),
        }
    }

    pub fn unexpected(error: impl fmt::Display) -> Self {
        Self {
            reason: FailureReason::Unexpected,
            message: error.to_string(),
        }
    }

    pub fn reason(&self) -> FailureReason {
        self.reason
    }
}

impl From<VaultPathError> for CommandError {
    fn from(error: VaultPathError) -> Self {
        Self {
            reason: FailureReason::OutsideVault,
            message: error.to_string(),
        }
    }
}

impl From<ArticleRepositoryError> for CommandError {
    fn from(error: ArticleRepositoryError) -> Self {
        match error {
            ArticleRepositoryError::OutsideVault(outside) => outside.into(),
            other @ (ArticleRepositoryError::Unreadable { .. }
            | ArticleRepositoryError::Unwritable { .. }
            | ArticleRepositoryError::AlreadyExists { .. }) => Self::unexpected(other),
        }
    }
}

impl From<WorkspaceRepositoryError> for CommandError {
    fn from(error: WorkspaceRepositoryError) -> Self {
        match error {
            WorkspaceRepositoryError::OutsideVault(outside) => outside.into(),
            other => Self::unexpected(other),
        }
    }
}

impl From<CreateArticleError> for CommandError {
    fn from(error: CreateArticleError) -> Self {
        match error {
            CreateArticleError::Draft(draft) => Self::unexpected(draft),
            CreateArticleError::Workspace(workspace) => workspace.into(),
            CreateArticleError::Article(article) => article.into(),
        }
    }
}

impl From<UpdateArticleMetadataError> for CommandError {
    fn from(error: UpdateArticleMetadataError) -> Self {
        match error {
            UpdateArticleMetadataError::Article(article) => article.into(),
            other @ (UpdateArticleMetadataError::Draft(_)
            | UpdateArticleMetadataError::FrontMatter(_)) => Self::unexpected(other),
        }
    }
}

impl From<TrashError> for CommandError {
    fn from(error: TrashError) -> Self {
        match error {
            TrashError::OutsideVault(outside) => outside.into(),
            other @ TrashError::NotMoved { .. } => Self::unexpected(other),
        }
    }
}

impl From<DeleteArticleError> for CommandError {
    fn from(error: DeleteArticleError) -> Self {
        match error {
            DeleteArticleError::Trash(trash) => trash.into(),
            other @ DeleteArticleError::NotAnArticle { .. } => Self::unexpected(other),
        }
    }
}

impl From<DeleteWorkspaceError> for CommandError {
    fn from(error: DeleteWorkspaceError) -> Self {
        match error {
            DeleteWorkspaceError::Workspace(workspace) => workspace.into(),
            DeleteWorkspaceError::Trash(trash) => trash.into(),
        }
    }
}

impl From<SettingsError> for CommandError {
    fn from(error: SettingsError) -> Self {
        match error {
            SettingsError::OutsideVault(outside) => outside.into(),
            other => Self::unexpected(other),
        }
    }
}

impl From<SaveClipboardImagesError> for CommandError {
    fn from(error: SaveClipboardImagesError) -> Self {
        match error {
            SaveClipboardImagesError::Image(ImageAssetRepositoryError::OutsideVault(outside)) => {
                outside.into()
            }
            other => Self::unexpected(other),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rustle_domain::{ArticleDraftError, WorkspaceName};
    use serde_json::json;

    #[test]
    fn an_unimplemented_channel_names_itself() {
        let error = CommandError::not_implemented(Channel::SaveBody);

        assert_eq!(
            serde_json::to_value(&error).expect("serializable"),
            json!({ "reason": "notImplemented", "message": "the saveBody channel is not implemented yet" })
        );
    }

    #[test]
    fn a_name_outside_the_vault_reports_the_rejected_name() {
        let rejected = WorkspaceName::parse("..").expect_err("'..' is rejected");

        let error = CommandError::from(rejected);

        assert_eq!(error.reason(), FailureReason::OutsideVault);
        assert!(error.to_string().contains(".."));
    }

    #[test]
    fn an_article_outside_the_vault_is_reported_as_outside_the_vault() {
        let rejected = WorkspaceName::parse("..").expect_err("'..' is rejected");

        let error = CommandError::from(ArticleRepositoryError::OutsideVault(rejected));

        assert_eq!(error.reason(), FailureReason::OutsideVault);
    }

    #[test]
    fn an_unreadable_article_is_unexpected_and_names_the_article() {
        let error = CommandError::from(ArticleRepositoryError::Unreadable {
            article: "Blog/missing.md".to_owned(),
            reason: "No such file or directory".to_owned(),
        });

        assert_eq!(error.reason(), FailureReason::Unexpected);
        assert!(error.to_string().contains("Blog/missing.md"));
    }

    #[test]
    fn an_unwritable_article_is_unexpected_and_keeps_the_reason() {
        let error = CommandError::from(ArticleRepositoryError::Unwritable {
            article: "Blog/zen.md".to_owned(),
            reason: "No space left on device".to_owned(),
        });

        assert_eq!(error.reason(), FailureReason::Unexpected);
        assert!(error.to_string().contains("No space left on device"));
    }

    #[test]
    fn a_workspace_or_settings_location_outside_the_vault_is_reported_as_outside_the_vault() {
        let rejected = || WorkspaceName::parse("..").expect_err("'..' is rejected");

        assert_eq!(
            CommandError::from(WorkspaceRepositoryError::OutsideVault(rejected())).reason(),
            FailureReason::OutsideVault
        );
        assert_eq!(
            CommandError::from(SettingsError::OutsideVault(rejected())).reason(),
            FailureReason::OutsideVault
        );
    }

    #[test]
    fn a_folder_or_settings_file_that_cannot_be_used_is_unexpected() {
        let unreadable = CommandError::from(WorkspaceRepositoryError::Unreadable {
            folder: "/Users/james/Rustle".to_owned(),
            reason: "Permission denied".to_owned(),
        });
        let unwritable = CommandError::from(SettingsError::Unwritable("disk full".to_owned()));

        assert_eq!(unreadable.reason(), FailureReason::Unexpected);
        assert!(unreadable.to_string().contains("Permission denied"));
        assert_eq!(unwritable.reason(), FailureReason::Unexpected);
    }

    #[test]
    fn an_article_creation_failure_keeps_the_reason_of_what_went_wrong() {
        let rejected = || WorkspaceName::parse("..").expect_err("'..' is rejected");

        assert_eq!(
            CommandError::from(CreateArticleError::Draft(ArticleDraftError::BlankTitle)).reason(),
            FailureReason::Unexpected
        );
        assert_eq!(
            CommandError::from(CreateArticleError::Workspace(
                WorkspaceRepositoryError::OutsideVault(rejected())
            ))
            .reason(),
            FailureReason::OutsideVault
        );
        assert_eq!(
            CommandError::from(CreateArticleError::Article(
                ArticleRepositoryError::OutsideVault(rejected())
            ))
            .reason(),
            FailureReason::OutsideVault
        );
        let taken = CommandError::from(CreateArticleError::Article(
            ArticleRepositoryError::AlreadyExists {
                article: "Blog/zen-of-writing.md".to_owned(),
            },
        ));
        assert_eq!(taken.reason(), FailureReason::Unexpected);
        assert!(taken.to_string().contains("Blog/zen-of-writing.md"));
    }

    #[test]
    fn a_trash_escape_is_outside_the_vault_and_a_refusal_keeps_its_reason() {
        let rejected = || WorkspaceName::parse("..").expect_err("'..' is rejected");
        let not_moved = || TrashError::NotMoved {
            item: "Blog/zen.md".to_owned(),
            reason: "Permission denied".to_owned(),
        };

        assert_eq!(
            CommandError::from(DeleteArticleError::Trash(TrashError::OutsideVault(
                rejected()
            )))
            .reason(),
            FailureReason::OutsideVault
        );
        assert_eq!(
            CommandError::from(DeleteWorkspaceError::Trash(TrashError::OutsideVault(
                rejected()
            )))
            .reason(),
            FailureReason::OutsideVault
        );
        let refused = CommandError::from(DeleteArticleError::Trash(not_moved()));
        assert_eq!(refused.reason(), FailureReason::Unexpected);
        assert!(refused.to_string().contains("Permission denied"));
        assert_eq!(
            CommandError::from(DeleteWorkspaceError::Trash(not_moved())).reason(),
            FailureReason::Unexpected
        );
        assert_eq!(
            CommandError::from(DeleteArticleError::NotAnArticle {
                file_name: "README.txt".to_owned()
            })
            .reason(),
            FailureReason::Unexpected
        );
        assert_eq!(
            CommandError::from(DeleteWorkspaceError::Workspace(
                WorkspaceRepositoryError::OutsideVault(rejected())
            ))
            .reason(),
            FailureReason::OutsideVault
        );
    }

    #[test]
    fn a_metadata_update_failure_keeps_the_reason_of_what_went_wrong() {
        let rejected = || WorkspaceName::parse("..").expect_err("'..' is rejected");

        assert_eq!(
            CommandError::from(UpdateArticleMetadataError::Draft(
                ArticleDraftError::BlankTitle
            ))
            .reason(),
            FailureReason::Unexpected
        );
        assert_eq!(
            CommandError::from(UpdateArticleMetadataError::FrontMatter(
                rustle_domain::UneditableFrontMatter
            ))
            .reason(),
            FailureReason::Unexpected
        );
        assert_eq!(
            CommandError::from(UpdateArticleMetadataError::Article(
                ArticleRepositoryError::OutsideVault(rejected())
            ))
            .reason(),
            FailureReason::OutsideVault
        );
    }

    #[test]
    fn a_failed_image_paste_keeps_its_reason_and_reports_an_outside_location_as_such() {
        let rejected = WorkspaceName::parse("..").expect_err("'..' is rejected");
        let outside = CommandError::from(SaveClipboardImagesError::Image(
            ImageAssetRepositoryError::OutsideVault(rejected),
        ));
        let disk_full = CommandError::from(SaveClipboardImagesError::Image(
            ImageAssetRepositoryError::Unwritable {
                image: "Blog/images/x.png".to_owned(),
                reason: "No space left on device".to_owned(),
            },
        ));

        assert_eq!(outside.reason(), FailureReason::OutsideVault);
        assert_eq!(disk_full.reason(), FailureReason::Unexpected);
        assert!(disk_full.to_string().contains("No space left on device"));
    }

    #[test]
    fn an_unknown_channel_names_what_was_asked_for() {
        let error = CommandError::unknown_channel("format_disk");

        assert_eq!(error.reason(), FailureReason::UnknownChannel);
        assert!(error.to_string().contains("format_disk"));
    }

    #[test]
    fn any_other_error_keeps_its_original_message() {
        let error = CommandError::unexpected("disk on fire");

        assert_eq!(
            serde_json::to_value(&error).expect("serializable"),
            json!({ "reason": "unexpected", "message": "disk on fire" })
        );
    }
}
