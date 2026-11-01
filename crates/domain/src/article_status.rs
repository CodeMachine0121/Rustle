use serde::{Deserialize, Serialize};

/// How far along an article is. An article has at most one, and only one of
/// these four; anything else written in a file counts as no status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ArticleStatus {
    Active,
    OnHold,
    Completed,
    Dropped,
}

impl ArticleStatus {
    /// Reads a front matter value as written by hand or by Rustle: case and
    /// the separator between "on" and "hold" do not matter.
    pub fn parse(text: &str) -> Option<Self> {
        let squeezed: String = text
            .trim()
            .chars()
            .filter(|character| !matches!(character, ' ' | '-' | '_'))
            .flat_map(char::to_lowercase)
            .collect();
        match squeezed.as_str() {
            "active" => Some(Self::Active),
            "onhold" => Some(Self::OnHold),
            "completed" => Some(Self::Completed),
            "dropped" => Some(Self::Dropped),
            _ => None,
        }
    }

    pub fn as_front_matter_value(self) -> &'static str {
        match self {
            Self::Active => "active",
            Self::OnHold => "on-hold",
            Self::Completed => "completed",
            Self::Dropped => "dropped",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    #[rstest]
    #[case("active", Some(ArticleStatus::Active))]
    #[case("Active", Some(ArticleStatus::Active))]
    #[case("on-hold", Some(ArticleStatus::OnHold))]
    #[case("On Hold", Some(ArticleStatus::OnHold))]
    #[case("on_hold", Some(ArticleStatus::OnHold))]
    #[case(" completed ", Some(ArticleStatus::Completed))]
    #[case("DROPPED", Some(ArticleStatus::Dropped))]
    #[case("進行中", None)]
    #[case("", None)]
    #[case("done", None)]
    fn reads_only_the_four_statuses(#[case] text: &str, #[case] expected: Option<ArticleStatus>) {
        assert_eq!(ArticleStatus::parse(text), expected);
    }

    #[rstest]
    #[case(ArticleStatus::Active)]
    #[case(ArticleStatus::OnHold)]
    #[case(ArticleStatus::Completed)]
    #[case(ArticleStatus::Dropped)]
    fn reads_back_what_it_writes(#[case] status: ArticleStatus) {
        assert_eq!(
            ArticleStatus::parse(status.as_front_matter_value()),
            Some(status)
        );
    }
}
