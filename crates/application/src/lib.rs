//! Use cases, one struct each.

mod read_article_body;
mod save_article_body;

pub use read_article_body::{ArticleBody, ReadArticleBody};
pub use save_article_body::{OutsideChanges, SaveArticleBody, SavedBody};
