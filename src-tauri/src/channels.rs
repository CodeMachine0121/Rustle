use tauri::Runtime;

use crate::channel::Channel;
use crate::channel_registry::ChannelHandler;
use crate::commands;

/// The single registration list: one line per channel.
pub fn channel_handlers<R: Runtime>() -> Vec<ChannelHandler<R>> {
    vec![
        ChannelHandler::new(
            Channel::ListWorkspaces,
            tauri::generate_handler![commands::list_workspaces::list_workspaces],
        ),
        ChannelHandler::new(
            Channel::ListArticles,
            tauri::generate_handler![commands::list_articles::list_articles],
        ),
        ChannelHandler::new(
            Channel::CreateWorkspace,
            tauri::generate_handler![commands::create_workspace::create_workspace],
        ),
        ChannelHandler::new(
            Channel::CreateArticle,
            tauri::generate_handler![commands::create_article::create_article],
        ),
        ChannelHandler::new(
            Channel::ReadBody,
            tauri::generate_handler![commands::read_body::read_body],
        ),
        ChannelHandler::new(
            Channel::SaveBody,
            tauri::generate_handler![commands::save_body::save_body],
        ),
        ChannelHandler::new(
            Channel::UpdateMetadata,
            tauri::generate_handler![commands::update_metadata::update_metadata],
        ),
        ChannelHandler::new(
            Channel::SaveClipboardImage,
            tauri::generate_handler![commands::save_clipboard_image::save_clipboard_image],
        ),
        ChannelHandler::new(
            Channel::ReadSettings,
            tauri::generate_handler![commands::read_settings::read_settings],
        ),
        ChannelHandler::new(
            Channel::WriteSettings,
            tauri::generate_handler![commands::write_settings::write_settings],
        ),
        ChannelHandler::new(
            Channel::WatchCloseRequests,
            tauri::generate_handler![commands::watch_close_requests::watch_close_requests],
        ),
        ChannelHandler::new(
            Channel::AnswerCloseRequest,
            tauri::generate_handler![commands::answer_close_request::answer_close_request],
        ),
    ]
}
