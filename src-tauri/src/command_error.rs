use std::fmt;

use rustle_domain::VaultPathError;
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

#[cfg(test)]
mod tests {
    use super::*;
    use rustle_domain::WorkspaceName;
    use serde_json::json;

    #[test]
    fn an_unimplemented_channel_names_itself() {
        let error = CommandError::not_implemented(Channel::ReadBody);

        assert_eq!(
            serde_json::to_value(&error).expect("serializable"),
            json!({ "reason": "notImplemented", "message": "the readBody channel is not implemented yet" })
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
