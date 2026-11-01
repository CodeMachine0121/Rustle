use mockall::predicate::eq;
use rustle_application::{DeleteArticle, DeleteArticleError};
use rustle_domain::{ArticleFileName, MockTrash, TrashError, WorkspaceName};

fn workspace(name: &str) -> WorkspaceName {
    WorkspaceName::parse(name).expect("valid workspace name")
}

fn article(name: &str) -> ArticleFileName {
    ArticleFileName::parse(name).expect("valid article name")
}

#[test]
fn hands_only_the_article_to_the_trash() {
    let mut trash = MockTrash::new();
    trash
        .expect_move_article_to_trash()
        .with(eq(workspace("Blog")), eq(article("tauri.md")))
        .times(1)
        .returning(|_, _| Ok(()));
    trash.expect_move_workspace_to_trash().never();

    let deleted = DeleteArticle::new(&trash).execute(&workspace("Blog"), &article("tauri.md"));

    assert_eq!(deleted, Ok(()));
}

#[test]
fn refuses_a_file_that_is_not_an_article_without_touching_the_trash() {
    let mut trash = MockTrash::new();
    trash.expect_move_article_to_trash().never();

    let refused = DeleteArticle::new(&trash).execute(&workspace("Blog"), &article("README.txt"));

    assert_eq!(
        refused,
        Err(DeleteArticleError::NotAnArticle {
            file_name: "README.txt".to_owned()
        })
    );
}

#[test]
fn reports_why_the_trash_refused() {
    let mut trash = MockTrash::new();
    trash.expect_move_article_to_trash().returning(|_, _| {
        Err(TrashError::NotMoved {
            item: "Blog/tauri.md".to_owned(),
            reason: "Permission denied".to_owned(),
        })
    });

    let refused = DeleteArticle::new(&trash).execute(&workspace("Blog"), &article("tauri.md"));

    assert!(
        refused
            .expect_err("the trash refused")
            .to_string()
            .contains("Permission denied")
    );
}
