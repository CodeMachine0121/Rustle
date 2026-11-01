use tauri::http::{Request, Response, StatusCode};

use crate::protocol_registry::SchemeHandler;

pub const VAULT_ASSET_SCHEME: &str = "rustle";

/// Serves vault images to the webview. The preview and paste-image work
/// replaces `respond`; until then every request is answered with 501.
pub struct VaultAssetScheme;

impl SchemeHandler for VaultAssetScheme {
    fn scheme(&self) -> &'static str {
        VAULT_ASSET_SCHEME
    }

    fn respond(&self, _request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
        let mut response = Response::new(
            format!("the {VAULT_ASSET_SCHEME} scheme is not implemented yet").into_bytes(),
        );
        *response.status_mut() = StatusCode::NOT_IMPLEMENTED;
        response
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn answers_not_implemented_and_names_the_scheme() {
        let request = Request::builder()
            .uri("rustle://localhost/Blog/images/cover.png")
            .body(Vec::new())
            .expect("valid request");

        let response = VaultAssetScheme.respond(&request);

        assert_eq!(response.status(), StatusCode::NOT_IMPLEMENTED);
        assert!(String::from_utf8_lossy(response.body()).contains("rustle"));
    }
}
