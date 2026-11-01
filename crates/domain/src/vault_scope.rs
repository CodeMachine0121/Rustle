use std::path::{Path, PathBuf};

use crate::vault_name::{ArticleFileName, ImageFileName, WorkspaceName};

pub const DEFAULT_VAULT_FOLDER_NAME: &str = "Rustle";
pub const IMAGES_FOLDER_NAME: &str = "images";
pub const SETTINGS_FOLDER_NAME: &str = ".rustle";
pub const SETTINGS_FILE_NAME: &str = "settings.json";

/// The only way to turn vault names into paths. Accepting parsed names
/// makes every returned path a direct, lexical descendant of the root.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VaultScope {
    root: PathBuf,
}

impl VaultScope {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Self { root: root.into() }
    }

    pub fn at_default_location(home: &Path) -> Self {
        Self::new(home.join(DEFAULT_VAULT_FOLDER_NAME))
    }

    pub fn root(&self) -> &Path {
        &self.root
    }

    pub fn workspace_path(&self, workspace: &WorkspaceName) -> PathBuf {
        self.root.join(workspace.as_str())
    }

    pub fn article_path(&self, workspace: &WorkspaceName, article: &ArticleFileName) -> PathBuf {
        self.workspace_path(workspace).join(article.as_str())
    }

    pub fn image_path(&self, workspace: &WorkspaceName, image: &ImageFileName) -> PathBuf {
        self.workspace_path(workspace)
            .join(IMAGES_FOLDER_NAME)
            .join(image.as_str())
    }

    pub fn settings_file_path(&self) -> PathBuf {
        self.root
            .join(SETTINGS_FOLDER_NAME)
            .join(SETTINGS_FILE_NAME)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn vault() -> VaultScope {
        VaultScope::new("/Users/james/Rustle")
    }

    fn workspace(name: &str) -> WorkspaceName {
        WorkspaceName::parse(name).expect("test workspace name is valid")
    }

    #[test]
    fn locates_a_workspace_inside_the_vault() {
        assert_eq!(
            vault().workspace_path(&workspace("Blog")),
            PathBuf::from("/Users/james/Rustle/Blog")
        );
    }

    #[test]
    fn locates_an_article_inside_its_workspace() {
        let article = ArticleFileName::parse("zen-of-writing.md").expect("valid article name");

        assert_eq!(
            vault().article_path(&workspace("Blog"), &article),
            PathBuf::from("/Users/james/Rustle/Blog/zen-of-writing.md")
        );
    }

    #[test]
    fn locates_an_image_inside_the_images_folder() {
        let image = ImageFileName::parse("8f3c1e42-9b2a-4d71-a6e5-0c3f8d1b7e94.png")
            .expect("valid image name");

        assert_eq!(
            vault().image_path(&workspace("Blog"), &image),
            PathBuf::from(
                "/Users/james/Rustle/Blog/images/8f3c1e42-9b2a-4d71-a6e5-0c3f8d1b7e94.png"
            )
        );
    }

    #[test]
    fn locates_a_workspace_with_a_non_ascii_name() {
        assert_eq!(
            vault().workspace_path(&workspace("讀書筆記")),
            PathBuf::from("/Users/james/Rustle/讀書筆記")
        );
    }

    #[test]
    fn locates_an_article_that_does_not_exist_yet() {
        let article = ArticleFileName::parse("not-created-yet.md").expect("valid article name");

        assert_eq!(
            vault().article_path(&workspace("Blog"), &article),
            PathBuf::from("/Users/james/Rustle/Blog/not-created-yet.md")
        );
    }

    #[test]
    fn defaults_to_a_rustle_folder_in_the_home_directory() {
        assert_eq!(
            VaultScope::at_default_location(Path::new("/Users/james")).root(),
            Path::new("/Users/james/Rustle")
        );
    }

    #[test]
    fn keeps_settings_in_the_hidden_rustle_folder() {
        assert_eq!(
            vault().settings_file_path(),
            PathBuf::from("/Users/james/Rustle/.rustle/settings.json")
        );
    }
}
