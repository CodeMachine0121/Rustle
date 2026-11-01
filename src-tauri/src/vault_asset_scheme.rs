use percent_encoding::percent_decode_str;
use rustle_domain::{
    IMAGES_FOLDER_NAME, ImageAssetRepository, ImageAssetRepositoryError, ImageFileName,
    WorkspaceName,
};
use tauri::http::header::{CONTENT_TYPE, HeaderValue, X_CONTENT_TYPE_OPTIONS};
use tauri::http::{Request, Response, StatusCode, Uri};
use url::Url;

use crate::protocol_registry::SchemeHandler;

pub const VAULT_ASSET_SCHEME: &str = "rustle";
pub const VAULT_ASSET_HOST: &str = "vault";

/// Serves the images in the vault's workspaces to the webview, and nothing
/// else: `rustle://vault/{workspace}/images/{image}`.
pub struct VaultAssetScheme<Images> {
    images: Images,
}

impl<Images> VaultAssetScheme<Images> {
    pub fn new(images: Images) -> Self {
        Self { images }
    }
}

impl<Images> SchemeHandler for VaultAssetScheme<Images>
where
    Images: ImageAssetRepository + Send + Sync + 'static,
{
    fn scheme(&self) -> &'static str {
        VAULT_ASSET_SCHEME
    }

    fn respond(&self, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
        let Some(asset) = VaultAssetRequest::parse(request.uri()) else {
            return refusal(StatusCode::FORBIDDEN);
        };
        match self.images.read(&asset.workspace, &asset.image) {
            Ok(bytes) => image(bytes, asset.media_type),
            Err(ImageAssetRepositoryError::NotFound { .. }) => refusal(StatusCode::NOT_FOUND),
            Err(ImageAssetRepositoryError::OutsideVault(_)) => refusal(StatusCode::FORBIDDEN),
            Err(_) => refusal(StatusCode::INTERNAL_SERVER_ERROR),
        }
    }
}

/// A request that names exactly one image file directly in some
/// workspace's images folder.
#[derive(Debug, PartialEq, Eq)]
struct VaultAssetRequest {
    workspace: WorkspaceName,
    image: ImageFileName,
    media_type: &'static str,
}

impl VaultAssetRequest {
    /// A literal `.` or `..` step is refused as written; an encoded one is
    /// folded away by the URL parser before any name is read.
    fn parse(uri: &Uri) -> Option<Self> {
        let steps_through_folders = uri
            .path()
            .split('/')
            .any(|segment| segment == "." || segment == "..");
        if steps_through_folders {
            return None;
        }
        let url = Url::parse(&uri.to_string()).ok()?;
        if url.scheme() != VAULT_ASSET_SCHEME || url.host_str() != Some(VAULT_ASSET_HOST) {
            return None;
        }
        let segments: Vec<String> = url
            .path_segments()?
            .map(|segment| percent_decode_str(segment).decode_utf8().map(String::from))
            .collect::<Result<_, _>>()
            .ok()?;
        let [workspace, folder, image] = segments.as_slice() else {
            return None;
        };
        if folder != IMAGES_FOLDER_NAME {
            return None;
        }
        let image = ImageFileName::parse(image).ok()?;
        Some(Self {
            workspace: WorkspaceName::parse(workspace).ok()?,
            media_type: image.media_type()?,
            image,
        })
    }
}

fn image(bytes: Vec<u8>, media_type: &'static str) -> Response<Vec<u8>> {
    let mut response = Response::new(bytes);
    let headers = response.headers_mut();
    headers.insert(CONTENT_TYPE, HeaderValue::from_static(media_type));
    headers.insert(X_CONTENT_TYPE_OPTIONS, HeaderValue::from_static("nosniff"));
    response
}

fn refusal(status: StatusCode) -> Response<Vec<u8>> {
    let reason = status.canonical_reason().unwrap_or("refused");
    let mut response = Response::new(reason.as_bytes().to_vec());
    *response.status_mut() = status;
    response
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::os::unix::fs::symlink;
    use std::path::PathBuf;

    use rstest::rstest;
    use rustle_domain::VaultScope;
    use rustle_infrastructure::{FileSystemImageAssetRepository, ResolvedVaultScope};
    use tempfile::TempDir;

    use super::*;

    struct Vault {
        directory: TempDir,
        root: PathBuf,
        scheme: VaultAssetScheme<FileSystemImageAssetRepository>,
    }

    impl Vault {
        fn create() -> Self {
            let directory = TempDir::new().expect("temporary directory");
            let root = directory.path().join("vault");
            fs::create_dir_all(root.join("Blog/images")).expect("images folder");
            let scheme = VaultAssetScheme::new(FileSystemImageAssetRepository::in_vault(
                ResolvedVaultScope::new(VaultScope::new(&root)),
            ));
            Self {
                directory,
                root,
                scheme,
            }
        }

        fn file(&self, relative_path: &str, contents: &str) -> &Self {
            let path = self.root.join(relative_path);
            fs::create_dir_all(path.parent().expect("has a folder")).expect("folder");
            fs::write(path, contents).expect("file written");
            self
        }

        fn outside(&self, relative_path: &str, contents: &str) -> PathBuf {
            let path = self.directory.path().join(relative_path);
            fs::create_dir_all(path.parent().expect("has a folder")).expect("folder");
            fs::write(&path, contents).expect("file written");
            path
        }

        fn get(&self, uri: &str) -> Response<Vec<u8>> {
            let request = Request::builder()
                .uri(uri)
                .body(Vec::new())
                .expect("valid request");
            self.scheme.respond(&request)
        }
    }

    fn content_type(response: &Response<Vec<u8>>) -> Option<&str> {
        response
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|value| value.to_str().ok())
    }

    fn uri(text: &str) -> Uri {
        text.parse().expect("valid uri")
    }

    #[test]
    fn serves_an_image_with_its_media_type() {
        let vault = Vault::create();
        vault.file("Blog/images/8f3c.png", "png pixels");

        let response = vault.get("rustle://vault/Blog/images/8f3c.png");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), b"png pixels");
        assert_eq!(content_type(&response), Some("image/png"));
        assert_eq!(
            response.headers().get(X_CONTENT_TYPE_OPTIONS),
            Some(&HeaderValue::from_static("nosniff"))
        );
    }

    #[rstest]
    #[case("x.png", "image/png")]
    #[case("x.gif", "image/gif")]
    #[case("x.jpg", "image/jpeg")]
    #[case("x.jpeg", "image/jpeg")]
    #[case("x.webp", "image/webp")]
    #[case("x.bmp", "image/bmp")]
    #[case("x.tif", "image/tiff")]
    #[case("x.tiff", "image/tiff")]
    #[case("x.svg", "image/svg+xml")]
    fn the_media_type_follows_the_extension(#[case] image: &str, #[case] media_type: &str) {
        let vault = Vault::create();
        vault.file(&format!("Blog/images/{image}"), "bytes");

        let response = vault.get(&format!("rustle://vault/Blog/images/{image}"));

        assert_eq!(content_type(&response), Some(media_type));
    }

    #[test]
    fn serves_workspaces_and_images_whose_names_need_encoding() {
        let vault = Vault::create();
        vault.file("隨筆 草稿/images/我.png", "pixels");

        let response = vault
            .get("rustle://vault/%E9%9A%A8%E7%AD%86%20%E8%8D%89%E7%A8%BF/images/%E6%88%91.png");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), b"pixels");
    }

    #[test]
    fn a_missing_image_is_not_found_without_naming_where_it_was_looked_for() {
        let vault = Vault::create();

        let response = vault.get("rustle://vault/Blog/images/nothing.png");

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body = String::from_utf8_lossy(response.body()).into_owned();
        assert!(!body.contains(&*vault.root.to_string_lossy()));
        assert!(!body.contains("nothing.png"));
    }

    #[rstest]
    #[case::escaping_the_vault("rustle://vault/../outside/images/x.png")]
    #[case::a_current_folder_step("rustle://vault/./Blog/images/x.png")]
    #[case::encoded_separators("rustle://vault/Blog/images/..%2F..%2Fsecret.png")]
    #[case::an_absolute_path("rustle://vault//tmp/images/x.png")]
    #[case::not_in_images("rustle://vault/Blog/zen-of-writing.md")]
    #[case::not_an_image_extension("rustle://vault/Blog/images/zen-of-writing.md")]
    #[case::the_settings_file("rustle://vault/.rustle/settings.json")]
    #[case::one_folder_too_deep("rustle://vault/Blog/images/nested/x.png")]
    #[case::no_file_name("rustle://vault/Blog/images/")]
    #[case::no_images_folder("rustle://vault/Blog/x.png")]
    #[case::another_folder("rustle://vault/Blog/other/x.png")]
    #[case::another_host("rustle://elsewhere/Blog/images/x.png")]
    #[case::another_scheme("https://vault/Blog/images/x.png")]
    #[case::a_prefix_lookalike("rustle://vault/..%2Fvault-evil/images/x.png")]
    #[case::undecodable_name("rustle://vault/Blog/images/%FF.png")]
    fn refuses_anything_but_one_image_in_a_workspace_images_folder(#[case] request: &str) {
        let vault = Vault::create();
        vault
            .file("Blog/images/x.png", "pixels")
            .file("Blog/images/zen-of-writing.md", "article")
            .file("Blog/images/nested/x.png", "pixels")
            .file("Blog/zen-of-writing.md", "article")
            .file("Blog/x.png", "pixels")
            .file(".rustle/settings.json", "{}");
        vault.outside("vault-evil/images/x.png", "evil");
        vault.outside("outside/images/x.png", "outside");

        let response = vault.get(request);

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_eq!(response.body(), b"Forbidden");
        assert_eq!(content_type(&response), None);
    }

    #[test]
    fn an_encoded_step_is_folded_away_and_stays_inside_the_vault() {
        let request = VaultAssetRequest::parse(&uri("rustle://vault/%2e%2e/outside/images/x.png"))
            .expect("read as a plain request");

        assert_eq!(request.workspace.as_str(), "outside");
        assert_eq!(request.image.as_str(), "x.png");
    }

    #[test]
    fn refuses_an_images_folder_that_links_outside_the_vault() {
        let vault = Vault::create();
        let outside = vault.outside("elsewhere/x.png", "secret");
        fs::remove_dir(vault.root.join("Blog/images")).expect("empty images folder");
        symlink(
            outside.parent().expect("folder"),
            vault.root.join("Blog/images"),
        )
        .expect("link");

        let response = vault.get("rustle://vault/Blog/images/x.png");

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        assert_ne!(response.body(), b"secret");
    }

    #[test]
    fn serves_an_images_folder_that_links_inside_the_vault() {
        let vault = Vault::create();
        vault.file("Shared/x.png", "shared pixels");
        fs::remove_dir(vault.root.join("Blog/images")).expect("empty images folder");
        symlink(vault.root.join("Shared"), vault.root.join("Blog/images")).expect("link");

        let response = vault.get("rustle://vault/Blog/images/x.png");

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.body(), b"shared pixels");
    }

    #[test]
    fn an_image_that_cannot_be_read_is_a_server_error_without_details() {
        let vault = Vault::create();
        fs::create_dir(vault.root.join("Blog/images/folder.png")).expect("folder");

        let response = vault.get("rustle://vault/Blog/images/folder.png");

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(response.body(), b"Internal Server Error");
    }
}
