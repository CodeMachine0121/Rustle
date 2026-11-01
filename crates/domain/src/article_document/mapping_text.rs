use yaml_rust2::{Yaml, YamlLoader};

use crate::metadata_update::{FieldValue, MetadataUpdate};

const DEFAULT_ITEM_INDENT: &str = "  ";

/// The text of a block mapping seen as top-level entries. An entry is its key
/// line plus the indented lines (or column-zero list items) that follow it;
/// blank and comment lines between entries belong to no entry, so they stay
/// where they are when an entry is rewritten.
pub(super) struct MappingText<'a> {
    lines: Vec<&'a str>,
    entries: Vec<Entry>,
    line_ending: &'static str,
}

struct Entry {
    key: String,
    colon: usize,
    start: usize,
    end: usize,
}

enum LineKind {
    Key { key: String, colon: usize },
    Continuation,
    Filler,
}

impl<'a> MappingText<'a> {
    pub(super) fn parse(content: &'a str, line_ending: &'static str) -> Self {
        let lines: Vec<&str> = content.split_inclusive('\n').collect();
        let mut entries: Vec<Entry> = Vec::new();
        for (index, line) in lines.iter().enumerate() {
            match LineKind::of(line) {
                LineKind::Key { key, colon } => entries.push(Entry {
                    key,
                    colon,
                    start: index,
                    end: index + 1,
                }),
                LineKind::Continuation => {
                    if let Some(entry) = entries.last_mut() {
                        entry.end = index + 1;
                    }
                }
                LineKind::Filler => {}
            }
        }
        Self {
            lines,
            entries,
            line_ending,
        }
    }

    /// New keys go right after the last entry, so trailing comments stay last.
    pub(super) fn apply(&self, update: &MetadataUpdate) -> String {
        let mut replacements: Vec<Option<String>> = self.entries.iter().map(|_| None).collect();
        let mut appended = String::new();
        for (key, value) in update.fields() {
            match self.entries.iter().position(|entry| entry.key == key) {
                Some(index) => {
                    replacements[index] = Some(self.rewrite_entry(&self.entries[index], value));
                }
                None => appended.push_str(&self.new_entry(key, value)),
            }
        }

        let mut output = String::new();
        let mut next_line = 0;
        for (entry, replacement) in self.entries.iter().zip(&replacements) {
            output.extend(self.lines[next_line..entry.start].iter().copied());
            match replacement {
                Some(text) => output.push_str(text),
                None => output.extend(self.lines[entry.start..entry.end].iter().copied()),
            }
            next_line = entry.end;
        }
        let insertion_line = self
            .entries
            .last()
            .map_or(self.lines.len(), |entry| entry.end);
        output.extend(self.lines[next_line..insertion_line].iter().copied());
        output.push_str(&appended);
        output.extend(self.lines[insertion_line..].iter().copied());
        output
    }

    fn rewrite_entry(&self, entry: &Entry, value: FieldValue<'_>) -> String {
        let key_line = self.lines[entry.start];
        let key_text = &key_line[..entry.colon];
        let after_colon = key_line[entry.colon + 1..].trim_end_matches(['\r', '\n']);
        match value {
            FieldValue::Text(text) => {
                let is_single_line = entry.end == entry.start + 1;
                let comment = is_single_line
                    .then(|| Self::trailing_comment(after_colon))
                    .flatten()
                    .unwrap_or_default();
                format!(
                    "{key_text}: {}{comment}{}",
                    Self::scalar(text),
                    self.line_ending
                )
            }
            FieldValue::List([]) => String::new(),
            FieldValue::List(items) => {
                let keeps_key_line =
                    after_colon.trim().is_empty() || after_colon.trim_start().starts_with('#');
                let mut text = if keeps_key_line {
                    key_line.to_owned()
                } else {
                    format!("{key_text}:{}", self.line_ending)
                };
                text.push_str(&self.list_items(&self.lines[entry.start + 1..entry.end], items));
                text
            }
        }
    }

    fn new_entry(&self, key: &str, value: FieldValue<'_>) -> String {
        match value {
            FieldValue::Text(text) => format!("{key}: {}{}", Self::scalar(text), self.line_ending),
            FieldValue::List([]) => String::new(),
            FieldValue::List(items) => {
                format!("{key}:{}{}", self.line_ending, self.list_items(&[], items))
            }
        }
    }

    /// Item lines whose value is kept are reused as they are, comments
    /// included; the others are written fresh.
    fn list_items(&self, old_lines: &[&str], items: &[String]) -> String {
        let mut reusable: Vec<(&str, Option<Yaml>)> = old_lines
            .iter()
            .filter(|line| line.trim_start().starts_with('-'))
            .map(|line| (*line, Self::item_value(line)))
            .collect();
        let indent = reusable.first().map_or(DEFAULT_ITEM_INDENT, |(line, _)| {
            &line[..line.len() - line.trim_start().len()]
        });
        let mut text = String::new();
        for item in items {
            let wanted = Some(Yaml::String(item.clone()));
            match reusable.iter().position(|(_, value)| *value == wanted) {
                Some(index) => text.push_str(reusable.remove(index).0),
                None => text.push_str(&format!(
                    "{indent}- {}{}",
                    Self::scalar(item),
                    self.line_ending
                )),
            }
        }
        text
    }

    fn item_value(line: &str) -> Option<Yaml> {
        match YamlLoader::load_from_str(line.trim()).ok()?.pop()? {
            Yaml::Array(mut items) if items.len() == 1 => items.pop(),
            _ => None,
        }
    }

    /// The comment after a scalar value, with the whitespace before it.
    fn trailing_comment(after_colon: &str) -> Option<&str> {
        let whole_value = Self::value_of(after_colon);
        after_colon
            .match_indices('#')
            .map(|(index, _)| &after_colon[..index])
            .filter(|before| before.ends_with([' ', '\t']))
            .find(|before| Self::value_of(before) == whole_value)
            .map(|before| &after_colon[before.trim_end().len()..])
    }

    /// Plain when YAML reads it back as the same string, else double-quoted.
    fn scalar(text: &str) -> String {
        let reads_back_unchanged = !text.chars().any(char::is_control)
            && Self::value_of(&format!(" {text}")) == Some(Yaml::String(text.to_owned()));
        if reads_back_unchanged {
            return text.to_owned();
        }
        let mut quoted = String::from('"');
        for character in text.chars() {
            match character {
                '"' => quoted.push_str("\\\""),
                '\\' => quoted.push_str("\\\\"),
                '\n' => quoted.push_str("\\n"),
                '\r' => quoted.push_str("\\r"),
                '\t' => quoted.push_str("\\t"),
                control if control.is_control() => {
                    quoted.push_str(&format!("\\u{:04X}", u32::from(control)));
                }
                other => quoted.push(other),
            }
        }
        quoted.push('"');
        quoted
    }

    fn value_of(after_colon: &str) -> Option<Yaml> {
        match YamlLoader::load_from_str(&format!("value:{after_colon}"))
            .ok()?
            .pop()?
        {
            Yaml::Hash(mut mapping) => mapping.remove(&Yaml::String("value".to_owned())),
            _ => None,
        }
    }
}

impl LineKind {
    fn of(line: &str) -> Self {
        let text = line.trim_end_matches(['\r', '\n']);
        let trimmed = text.trim_start();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            return Self::Filler;
        }
        if text.starts_with([' ', '\t', '-']) {
            return Self::Continuation;
        }
        let colon = text
            .match_indices(':')
            .map(|(index, _)| index)
            .find(|&index| {
                let rest = &text[index + 1..];
                rest.is_empty() || rest.starts_with([' ', '\t'])
            });
        match colon {
            Some(colon) => Self::Key {
                key: text[..colon].trim().trim_matches(['"', '\'']).to_owned(),
                colon,
            },
            None => Self::Continuation,
        }
    }
}
