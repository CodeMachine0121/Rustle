use std::fmt;

macro_rules! channels {
    ($($variant:ident => $name:literal, $command_name:literal;)+) => {
        /// Every named channel the webview may call. The frontend name is
        /// what `src/ipc/channels.ts` exposes; the command name is the Tauri
        /// command that answers it.
        #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
        pub enum Channel {
            $($variant,)+
        }

        impl Channel {
            pub const ALL: &'static [Channel] = &[$(Channel::$variant,)+];

            pub fn name(self) -> &'static str {
                match self {
                    $(Channel::$variant => $name,)+
                }
            }

            pub fn command_name(self) -> &'static str {
                match self {
                    $(Channel::$variant => $command_name,)+
                }
            }
        }
    };
}

channels! {
    ListWorkspaces => "listWorkspaces", "list_workspaces";
    ListArticles => "listArticles", "list_articles";
    ListAllArticles => "listAllArticles", "list_all_articles";
    CreateWorkspace => "createWorkspace", "create_workspace";
    CreateArticle => "createArticle", "create_article";
    ReadBody => "readBody", "read_body";
    SearchBodies => "searchBodies", "search_bodies";
    SaveBody => "saveBody", "save_body";
    UpdateMetadata => "updateMetadata", "update_metadata";
    DeleteArticle => "deleteArticle", "delete_article";
    RenameWorkspace => "renameWorkspace", "rename_workspace";
    CountWorkspaceContents => "countWorkspaceContents", "count_workspace_contents";
    DeleteWorkspace => "deleteWorkspace", "delete_workspace";
    SaveClipboardImage => "saveClipboardImage", "save_clipboard_image";
    ReadSettings => "readSettings", "read_settings";
    WriteSettings => "writeSettings", "write_settings";
    ReadPreferredLocales => "readPreferredLocales", "read_preferred_locales";
    WatchCloseRequests => "watchCloseRequests", "watch_close_requests";
    AnswerCloseRequest => "answerCloseRequest", "answer_close_request";
}

impl Channel {
    pub fn from_command_name(command_name: &str) -> Option<Self> {
        Self::ALL
            .iter()
            .copied()
            .find(|channel| channel.command_name() == command_name)
    }
}

impl fmt::Display for Channel {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.name())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_names_are_the_snake_case_spelling_of_the_channel_names() {
        for channel in Channel::ALL {
            let snake_case: String = channel
                .name()
                .chars()
                .flat_map(|character| {
                    let separator = character.is_uppercase().then_some('_');
                    separator.into_iter().chain(character.to_lowercase())
                })
                .collect();
            assert_eq!(channel.command_name(), snake_case);
        }
    }

    #[test]
    fn finds_a_channel_by_its_command_name() {
        assert_eq!(
            Channel::from_command_name("save_body"),
            Some(Channel::SaveBody)
        );
        assert_eq!(Channel::from_command_name("format_disk"), None);
    }
}
