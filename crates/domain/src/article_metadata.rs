use yaml_rust2::Yaml;
use yaml_rust2::yaml::Hash;

use crate::metadata_update::{CATEGORY_KEY, CREATED_AT_KEY, TAGS_KEY, TITLE_KEY, UPDATED_AT_KEY};
use crate::vault_name::ArticleFileName;

/// What a front matter says about its article, read tolerantly: a missing or
/// unusable title falls back to the file name and marks the metadata
/// incomplete.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ArticleMetadata {
    pub title: String,
    pub created_at: String,
    pub updated_at: String,
    pub category: Vec<String>,
    pub tags: Vec<String>,
    pub has_incomplete_metadata: bool,
}

impl ArticleMetadata {
    /// `mapping` is `None` when the front matter is missing a usable mapping.
    pub(crate) fn read(mapping: Option<&Hash>, file_name: &ArticleFileName) -> Self {
        let field =
            |key: &str| mapping.and_then(|mapping| mapping.get(&Yaml::String(key.to_owned())));
        let text = |key: &str| {
            field(key)
                .and_then(Yaml::as_str)
                .unwrap_or_default()
                .to_owned()
        };
        let list = |key: &str| match field(key) {
            Some(Yaml::String(single)) => vec![single.clone()],
            Some(Yaml::Array(items)) => items
                .iter()
                .filter_map(Yaml::as_str)
                .map(str::to_owned)
                .collect(),
            _ => Vec::new(),
        };
        let title = field(TITLE_KEY)
            .and_then(Yaml::as_str)
            .filter(|title| !title.trim().is_empty());
        let file_name = file_name.as_str();
        Self {
            title: title
                .unwrap_or_else(|| file_name.strip_suffix(".md").unwrap_or(file_name))
                .to_owned(),
            created_at: text(CREATED_AT_KEY),
            updated_at: text(UPDATED_AT_KEY),
            category: list(CATEGORY_KEY),
            tags: list(TAGS_KEY),
            has_incomplete_metadata: title.is_none(),
        }
    }
}
