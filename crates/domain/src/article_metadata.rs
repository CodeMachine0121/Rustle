use std::collections::HashSet;

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
    /// What can be said about an article whose contents are unknown: its
    /// file name stands in for the title, and the metadata is incomplete.
    pub fn from_file_name(file_name: &ArticleFileName) -> Self {
        Self::read(None, file_name)
    }

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
        let mut tags = list(TAGS_KEY);
        let mut seen = HashSet::new();
        tags.retain(|tag| seen.insert(tag.clone()));
        let title = field(TITLE_KEY)
            .and_then(Yaml::as_str)
            .filter(|title| !title.trim().is_empty());
        Self {
            title: title.map(str::to_owned).unwrap_or_else(|| {
                file_name
                    .markdown_stem()
                    .unwrap_or(file_name.as_str())
                    .to_owned()
            }),
            created_at: text(CREATED_AT_KEY),
            updated_at: text(UPDATED_AT_KEY),
            category: list(CATEGORY_KEY),
            tags,
            has_incomplete_metadata: title.is_none(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case("unreadable.md", "unreadable")]
    #[case("LEGACY.MD", "LEGACY")]
    #[case("notes.Md", "notes")]
    fn an_article_known_only_by_name_is_titled_by_it_and_incomplete(
        #[case] file_name: &str,
        #[case] title: &str,
    ) {
        let file_name = ArticleFileName::parse(file_name).expect("valid article file name");

        assert_eq!(
            ArticleMetadata::from_file_name(&file_name),
            ArticleMetadata {
                title: title.to_owned(),
                has_incomplete_metadata: true,
                ..ArticleMetadata::default()
            }
        );
    }
}
