use yaml_rust2::yaml::Hash;
use yaml_rust2::{Yaml, YamlLoader};

use crate::metadata_update::{FieldValue, MetadataUpdate};

use super::mapping_text::MappingText;

const DELIMITER: &str = "---";

/// The raw `---` block at the top of an article. Each delimiter line keeps
/// its own trailing whitespace and line break.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(super) struct FrontMatter {
    opening: String,
    content: String,
    closing: String,
}

impl FrontMatter {
    /// The first line and a later line must both be `---`; otherwise the
    /// text has no front matter.
    pub(super) fn split_from(text: &str) -> Option<(Self, &str)> {
        let mut lines = text.split_inclusive('\n');
        let opening = lines.next().filter(|line| Self::is_delimiter(line))?;
        let mut content_end = opening.len();
        for line in lines {
            if Self::is_delimiter(line) {
                let front_matter = Self {
                    opening: opening.to_owned(),
                    content: text[opening.len()..content_end].to_owned(),
                    closing: line.to_owned(),
                };
                return Some((front_matter, &text[content_end + line.len()..]));
            }
            content_end += line.len();
        }
        None
    }

    pub(super) fn empty(line_ending: &str) -> Self {
        Self {
            opening: format!("{DELIMITER}{line_ending}"),
            content: String::new(),
            closing: format!("{DELIMITER}{line_ending}"),
        }
    }

    pub(super) fn is_empty(&self) -> bool {
        self.content.is_empty()
    }

    pub(super) fn line_ending(&self) -> &'static str {
        if self.opening.ends_with("\r\n") {
            "\r\n"
        } else {
            "\n"
        }
    }

    pub(super) fn ends_with_line_break(&self) -> bool {
        self.closing.ends_with('\n')
    }

    pub(super) fn to_text(&self) -> String {
        [self.opening.as_str(), &self.content, &self.closing].concat()
    }

    /// `None` when the block is not valid YAML or not a mapping.
    pub(super) fn mapping(&self) -> Option<Hash> {
        Self::parse_mapping(&self.content)
    }

    /// Rewrites only the top-level entries the update names. `None` when the
    /// block cannot be edited, or when the edited text would not read back
    /// as exactly the original mapping with the update applied.
    pub(super) fn with_update(&self, update: &MetadataUpdate) -> Option<Self> {
        let expected = Self::apply_to_mapping(self.mapping()?, update);
        let content = MappingText::parse(&self.content, self.line_ending()).apply(update);
        (Self::parse_mapping(&content)? == expected).then(|| Self {
            content,
            ..self.clone()
        })
    }

    fn is_delimiter(line: &str) -> bool {
        line.trim_end_matches(['\r', '\n'])
            .strip_prefix(DELIMITER)
            .is_some_and(|rest| {
                rest.chars()
                    .all(|character| character == ' ' || character == '\t')
            })
    }

    fn parse_mapping(content: &str) -> Option<Hash> {
        let documents = YamlLoader::load_from_str(content).ok()?;
        match documents.into_iter().next() {
            None => Some(Hash::new()),
            Some(Yaml::Hash(mapping)) => Some(mapping),
            Some(_) => None,
        }
    }

    fn apply_to_mapping(mut mapping: Hash, update: &MetadataUpdate) -> Hash {
        for (key, value) in update.fields() {
            let key = Yaml::String(key.to_owned());
            match value {
                FieldValue::Text(text) => {
                    mapping.replace(key, Yaml::String(text.to_owned()));
                }
                FieldValue::List([]) => {
                    mapping.remove(&key);
                }
                FieldValue::List(items) => {
                    let items = items.iter().cloned().map(Yaml::String).collect();
                    mapping.replace(key, Yaml::Array(items));
                }
            }
        }
        mapping
    }
}
