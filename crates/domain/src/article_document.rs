mod front_matter;
mod mapping_text;
#[cfg(test)]
mod tests;

use thiserror::Error;

use crate::article_metadata::ArticleMetadata;
use crate::metadata_update::MetadataUpdate;
use crate::vault_name::ArticleFileName;

use front_matter::FrontMatter;

const BYTE_ORDER_MARK: char = '\u{feff}';

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
#[error("the front matter is not a mapping that can be edited safely")]
pub struct UneditableFrontMatter;

/// An article file split into its front matter and its body. Rendering it
/// back gives the original text byte for byte, except where a change was
/// asked for.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ArticleDocument {
    starts_with_byte_order_mark: bool,
    front_matter: Option<FrontMatter>,
    body: String,
}

impl ArticleDocument {
    pub fn parse(text: &str) -> Self {
        let (starts_with_byte_order_mark, text) = match text.strip_prefix(BYTE_ORDER_MARK) {
            Some(rest) => (true, rest),
            None => (false, text),
        };
        let (front_matter, body) = match FrontMatter::split_from(text) {
            Some((front_matter, body)) => (Some(front_matter), body),
            None => (None, text),
        };
        Self {
            starts_with_byte_order_mark,
            front_matter,
            body: body.to_owned(),
        }
    }

    pub fn body(&self) -> &str {
        &self.body
    }

    pub fn into_body(self) -> String {
        self.body
    }

    pub fn metadata(&self, file_name: &ArticleFileName) -> ArticleMetadata {
        let mapping = self.front_matter.as_ref().and_then(FrontMatter::mapping);
        ArticleMetadata::read(mapping.as_ref(), file_name)
    }

    pub fn with_body(self, body: impl Into<String>) -> Self {
        Self {
            body: body.into(),
            ..self
        }
    }

    /// Writes the known fields. A front matter that cannot be edited safely
    /// (broken YAML, not a plain mapping) is kept exactly as it was.
    pub fn with_metadata(self, update: &MetadataUpdate) -> Self {
        let front_matter = match self.front_matter {
            Some(existing) => Some(existing.with_update(update).unwrap_or(existing)),
            None => FrontMatter::empty(self.body_line_ending())
                .with_update(update)
                .filter(|created| !created.is_empty()),
        };
        Self {
            front_matter,
            ..self
        }
    }

    /// Like `with_metadata`, but refuses instead of keeping a front matter
    /// it cannot edit safely.
    pub fn edit_metadata(self, update: &MetadataUpdate) -> Result<Self, UneditableFrontMatter> {
        match &self.front_matter {
            Some(existing) => {
                let front_matter = existing.with_update(update).ok_or(UneditableFrontMatter)?;
                Ok(Self {
                    front_matter: Some(front_matter),
                    ..self
                })
            }
            None => Ok(self.with_metadata(update)),
        }
    }

    pub fn to_text(&self) -> String {
        let mut text = String::new();
        if self.starts_with_byte_order_mark {
            text.push(BYTE_ORDER_MARK);
        }
        if let Some(front_matter) = &self.front_matter {
            text.push_str(&front_matter.to_text());
            if !front_matter.ends_with_line_break() && !self.body.is_empty() {
                text.push_str(front_matter.line_ending());
            }
        }
        text.push_str(&self.body);
        text
    }

    fn body_line_ending(&self) -> &'static str {
        if self.body.contains("\r\n") {
            "\r\n"
        } else {
            "\n"
        }
    }
}
