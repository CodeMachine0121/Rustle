use crate::article_status::ArticleStatus;

/// The known front matter fields to write; fields left unset are not touched.
/// Empty `tags` removes that key, and so does `without_status`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MetadataUpdate {
    title: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    status: Option<StatusChange>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum StatusChange {
    Set(ArticleStatus),
    Remove,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum FieldValue<'a> {
    Text(&'a str),
    List(&'a [String]),
    Removed,
}

impl MetadataUpdate {
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.title = Some(title.into());
        self
    }

    pub fn created_at(mut self, created_at: impl Into<String>) -> Self {
        self.created_at = Some(created_at.into());
        self
    }

    pub fn updated_at(mut self, updated_at: impl Into<String>) -> Self {
        self.updated_at = Some(updated_at.into());
        self
    }

    pub fn status(mut self, status: ArticleStatus) -> Self {
        self.status = Some(StatusChange::Set(status));
        self
    }

    pub fn without_status(mut self) -> Self {
        self.status = Some(StatusChange::Remove);
        self
    }

    pub fn tags(mut self, tags: impl IntoIterator<Item = impl Into<String>>) -> Self {
        self.tags = Some(tags.into_iter().map(Into::into).collect());
        self
    }

    /// The requested fields as `(key, value)` in the order new keys are written.
    pub(crate) fn fields(&self) -> impl Iterator<Item = (&'static str, FieldValue<'_>)> {
        let status = self.status.map(|change| match change {
            StatusChange::Set(status) => FieldValue::Text(status.as_front_matter_value()),
            StatusChange::Remove => FieldValue::Removed,
        });
        [
            (TITLE_KEY, self.title.as_deref().map(FieldValue::Text)),
            (
                CREATED_AT_KEY,
                self.created_at.as_deref().map(FieldValue::Text),
            ),
            (
                UPDATED_AT_KEY,
                self.updated_at.as_deref().map(FieldValue::Text),
            ),
            (STATUS_KEY, status),
            (TAGS_KEY, self.tags.as_deref().map(FieldValue::List)),
        ]
        .into_iter()
        .filter_map(|(key, value)| value.map(|value| (key, value)))
    }
}

pub(crate) const TITLE_KEY: &str = "title";
pub(crate) const CREATED_AT_KEY: &str = "created_at";
pub(crate) const UPDATED_AT_KEY: &str = "updated_at";
pub(crate) const STATUS_KEY: &str = "status";
pub(crate) const TAGS_KEY: &str = "tags";
