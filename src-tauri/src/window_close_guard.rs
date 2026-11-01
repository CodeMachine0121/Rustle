use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, PoisonError};

use tauri::ipc::Channel;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CloseRequestDecision {
    Close,
    KeepOpenAndAskWebview,
}

/// Lets the webview finish saving before the window closes. A close request
/// is held back and passed to the webview, which answers whether to close.
/// Without a watching webview, or while an earlier request is still
/// unanswered, the window closes right away, so it can never get stuck open.
#[derive(Default)]
pub struct WindowCloseGuard {
    watcher: Mutex<Option<Channel<()>>>,
    awaiting_answer: AtomicBool,
}

impl WindowCloseGuard {
    pub fn watch(&self, on_close_request: Channel<()>) {
        *self.watcher.lock().unwrap_or_else(PoisonError::into_inner) = Some(on_close_request);
        self.awaiting_answer.store(false, Ordering::SeqCst);
    }

    pub fn close_requested(&self) -> CloseRequestDecision {
        let watcher = self.watcher.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(on_close_request) = watcher.as_ref() else {
            return CloseRequestDecision::Close;
        };
        if self.awaiting_answer.swap(true, Ordering::SeqCst) {
            return CloseRequestDecision::Close;
        }
        if on_close_request.send(()).is_err() {
            self.awaiting_answer.store(false, Ordering::SeqCst);
            return CloseRequestDecision::Close;
        }
        CloseRequestDecision::KeepOpenAndAskWebview
    }

    pub fn answered(&self) {
        self.awaiting_answer.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;
    use std::sync::atomic::AtomicUsize;

    use super::*;

    fn counting_channel() -> (Channel<()>, Arc<AtomicUsize>) {
        let requests = Arc::new(AtomicUsize::new(0));
        let counter = Arc::clone(&requests);
        let channel = Channel::new(move |_message| {
            counter.fetch_add(1, Ordering::SeqCst);
            Ok(())
        });
        (channel, requests)
    }

    #[test]
    fn closes_right_away_when_no_webview_watches() {
        assert_eq!(
            WindowCloseGuard::default().close_requested(),
            CloseRequestDecision::Close
        );
    }

    #[test]
    fn holds_the_close_back_and_asks_the_webview() {
        let guard = WindowCloseGuard::default();
        let (channel, requests) = counting_channel();
        guard.watch(channel);

        assert_eq!(
            guard.close_requested(),
            CloseRequestDecision::KeepOpenAndAskWebview
        );
        assert_eq!(requests.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn lets_a_second_request_through_while_the_first_is_unanswered() {
        let guard = WindowCloseGuard::default();
        let (channel, requests) = counting_channel();
        guard.watch(channel);
        guard.close_requested();

        assert_eq!(guard.close_requested(), CloseRequestDecision::Close);
        assert_eq!(requests.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn asks_the_webview_again_once_it_answered() {
        let guard = WindowCloseGuard::default();
        let (channel, requests) = counting_channel();
        guard.watch(channel);
        guard.close_requested();
        guard.answered();

        assert_eq!(
            guard.close_requested(),
            CloseRequestDecision::KeepOpenAndAskWebview
        );
        assert_eq!(requests.load(Ordering::SeqCst), 2);
    }

    #[test]
    fn closes_when_the_webview_cannot_be_reached() {
        let guard = WindowCloseGuard::default();
        guard.watch(Channel::new(|_message| Err(tauri::Error::WebviewNotFound)));

        assert_eq!(guard.close_requested(), CloseRequestDecision::Close);
        assert_eq!(guard.close_requested(), CloseRequestDecision::Close);
    }
}
