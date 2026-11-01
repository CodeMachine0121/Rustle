use url::Url;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum NavigationDecision {
    Allow,
    Deny { open_in_browser: bool },
}

/// Keeps the window on the app page: a remote page loaded into it would
/// inherit every Rustle channel.
#[derive(Debug, Clone)]
pub struct NavigationPolicy {
    app_page: Url,
}

impl NavigationPolicy {
    pub fn new(app_page: Url) -> Self {
        Self { app_page }
    }

    pub fn decide(&self, target: &str) -> NavigationDecision {
        match Url::parse(target) {
            Ok(target) if self.is_app_page(&target) => NavigationDecision::Allow,
            Ok(target) => NavigationDecision::Deny {
                open_in_browser: matches!(target.scheme(), "http" | "https"),
            },
            Err(_) => NavigationDecision::Deny {
                open_in_browser: false,
            },
        }
    }

    fn is_app_page(&self, target: &Url) -> bool {
        target.scheme() == self.app_page.scheme()
            && target.host_str() == self.app_page.host_str()
            && target.port_or_known_default() == self.app_page.port_or_known_default()
            && target.path() == self.app_page.path()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    const APP_PAGE: &str = "tauri://localhost/index.html";

    fn policy() -> NavigationPolicy {
        NavigationPolicy::new(Url::parse(APP_PAGE).expect("valid app page"))
    }

    #[rstest]
    #[case::the_same_page("tauri://localhost/index.html")]
    #[case::a_fragment_of_the_same_page("tauri://localhost/index.html#heading")]
    #[case::the_same_page_with_a_query("tauri://localhost/index.html?reload=1")]
    fn allows_staying_on_the_app_page(#[case] target: &str) {
        assert_eq!(policy().decide(target), NavigationDecision::Allow);
    }

    #[rstest]
    #[case::a_remote_https_page("https://example.com/")]
    #[case::a_remote_http_page("http://example.com/")]
    #[case::another_file("file:///etc/passwd")]
    #[case::a_sibling_page("tauri://localhost/other.html")]
    #[case::another_host_on_the_app_scheme("tauri://elsewhere/index.html")]
    #[case::a_blank_page("about:blank")]
    #[case::script_disguised_as_a_location("javascript:alert(1)")]
    #[case::a_document_disguised_as_a_location("data:text/html,<h1>hi</h1>")]
    #[case::not_a_location_at_all("not a location")]
    fn denies_leaving_the_app_page(#[case] target: &str) {
        assert!(matches!(
            policy().decide(target),
            NavigationDecision::Deny { .. }
        ));
    }

    #[rstest]
    #[case("https://example.com/", true)]
    #[case("http://example.com/", true)]
    #[case("javascript:alert(1)", false)]
    #[case("data:text/html,<h1>hi</h1>", false)]
    #[case("file:///etc/passwd", false)]
    #[case("rustle://vault/images/x.png", false)]
    fn hands_only_web_pages_to_the_browser(#[case] target: &str, #[case] open_in_browser: bool) {
        assert_eq!(
            policy().decide(target),
            NavigationDecision::Deny { open_in_browser }
        );
    }

    #[test]
    fn treats_a_dev_server_page_on_another_port_as_leaving() {
        let policy = NavigationPolicy::new(
            Url::parse("http://localhost:1420/index.html").expect("valid dev page"),
        );

        assert_eq!(
            policy.decide("http://localhost:1421/index.html"),
            NavigationDecision::Deny {
                open_in_browser: true
            }
        );
    }
}
