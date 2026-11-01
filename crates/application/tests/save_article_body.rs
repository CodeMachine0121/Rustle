use std::fs;
use std::path::PathBuf;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use rustle_application::{OutsideChanges, ReadArticleBody, SaveArticleBody, SavedBody};
use rustle_domain::{
    ArticleFileName, ArticleRepositoryError, MockClock, VaultScope, WorkspaceName,
};
use rustle_infrastructure::{FileSystemArticleRepository, ResolvedVaultScope};
use serde_json::json;
use tempfile::TempDir;

const SAVED_AT_MILLISECONDS: u64 = 1_787_213_051_123;
const SAVED_AT: &str = "2026-08-20T08:04:11.123Z";

struct Vault {
    _directory: TempDir,
    article_path: PathBuf,
    articles: FileSystemArticleRepository,
    clock: MockClock,
}

impl Vault {
    fn with_article(text: &str) -> Self {
        let directory = TempDir::new().expect("temporary directory");
        let root = directory.path().join("Rustle");
        fs::create_dir_all(root.join("Blog")).expect("workspace folder");
        let article_path = root.join("Blog").join("zen.md");
        fs::write(&article_path, text).expect("article written");
        let mut clock = MockClock::new();
        clock
            .expect_now()
            .return_const(UNIX_EPOCH + Duration::from_millis(SAVED_AT_MILLISECONDS));
        Self {
            _directory: directory,
            article_path,
            articles: FileSystemArticleRepository::in_vault(ResolvedVaultScope::new(
                VaultScope::new(root),
            )),
            clock,
        }
    }

    fn workspace() -> WorkspaceName {
        WorkspaceName::parse("Blog").expect("valid workspace name")
    }

    fn article() -> ArticleFileName {
        ArticleFileName::parse("zen.md").expect("valid article name")
    }

    fn last_known_modified_at(&self) -> String {
        ReadArticleBody::new(&self.articles)
            .execute(&Self::workspace(), &Self::article())
            .expect("readable")
            .last_known_modified_at
    }

    fn save(
        &self,
        body: &str,
        last_known_modified_at: &str,
        outside_changes: OutsideChanges,
    ) -> Result<SavedBody, ArticleRepositoryError> {
        SaveArticleBody::new(&self.articles, &self.clock).execute(
            &Self::workspace(),
            &Self::article(),
            body,
            last_known_modified_at,
            outside_changes,
        )
    }

    fn save_as_loaded(&self, body: &str) -> SavedBody {
        let loaded_at = self.last_known_modified_at();
        self.save(body, &loaded_at, OutsideChanges::Refuse)
            .expect("saved")
    }

    fn text(&self) -> String {
        fs::read_to_string(&self.article_path).expect("readable")
    }

    fn change_outside(&self, text: &str) {
        fs::write(&self.article_path, text).expect("outside edit");
        fs::File::options()
            .write(true)
            .open(&self.article_path)
            .and_then(|file| file.set_modified(SystemTime::now() + Duration::from_secs(60)))
            .expect("modification time set");
    }
}

#[test]
fn writes_the_body_and_answers_with_the_new_modification_time() {
    let vault = Vault::with_article(
        "---\ntitle: Zen\nupdated_at: 2026-01-01T00:00:00.000Z\n---\n舊的正文\n",
    );

    let saved = vault.save_as_loaded("新的正文\n");

    assert_eq!(
        saved,
        SavedBody::Saved {
            updated_at: SAVED_AT.to_owned(),
            last_known_modified_at: vault.last_known_modified_at(),
        }
    );
    assert_eq!(
        vault.text(),
        format!("---\ntitle: Zen\nupdated_at: {SAVED_AT}\n---\n新的正文\n")
    );
}

#[test]
fn keeps_unknown_fields_key_order_and_comments_and_changes_only_updated_at() {
    let vault = Vault::with_article(
        "---\n# 我的註解\ntags:\n  - writing\nmood: calm  # 自訂欄位\ntitle: Zen\nupdated_at: 2026-01-01T00:00:00.000Z\ncreated_at: 2025-12-31T00:00:00.000Z\n---\n舊的正文\n",
    );

    vault.save_as_loaded("新的正文\n");

    assert_eq!(
        vault.text(),
        format!(
            "---\n# 我的註解\ntags:\n  - writing\nmood: calm  # 自訂欄位\ntitle: Zen\nupdated_at: {SAVED_AT}\ncreated_at: 2025-12-31T00:00:00.000Z\n---\n新的正文\n"
        )
    );
}

#[test]
fn keeps_a_status_it_cannot_read_and_the_retired_category_as_written() {
    let vault = Vault::with_article(
        "---\ntitle: Zen\nstatus: 進行中\ncategory:\n  - 技術筆記\n  - 桌面開發\nupdated_at: 2026-01-01T00:00:00.000Z\n---\n舊的正文\n",
    );

    vault.save_as_loaded("新的正文\n");

    assert_eq!(
        vault.text(),
        format!(
            "---\ntitle: Zen\nstatus: 進行中\ncategory:\n  - 技術筆記\n  - 桌面開發\nupdated_at: {SAVED_AT}\n---\n新的正文\n"
        )
    );
}

#[test]
fn gives_an_article_without_front_matter_a_block_with_only_updated_at() {
    let vault = Vault::with_article("# 只有正文\n");

    vault.save_as_loaded("# 新的正文\n");

    assert_eq!(
        vault.text(),
        format!("---\nupdated_at: {SAVED_AT}\n---\n# 新的正文\n")
    );
}

#[test]
fn saves_the_body_and_keeps_a_broken_front_matter_block_verbatim() {
    let broken_block = "---\ntitle: [unclosed\n  : : nonsense\n---\n";
    let vault = Vault::with_article(&format!("{broken_block}舊的正文\n"));

    vault.save_as_loaded("新的正文\n");

    assert_eq!(vault.text(), format!("{broken_block}新的正文\n"));
}

#[test]
fn keeps_the_byte_order_mark_and_crlf_line_endings() {
    let vault = Vault::with_article(
        "\u{feff}---\r\ntitle: Zen\r\nupdated_at: 2026-01-01T00:00:00.000Z\r\n---\r\n舊的正文\r\n",
    );

    vault.save_as_loaded("新的正文\r\n");

    assert_eq!(
        vault.text(),
        format!("\u{feff}---\r\ntitle: Zen\r\nupdated_at: {SAVED_AT}\r\n---\r\n新的正文\r\n")
    );
}

#[test]
fn refuses_to_save_over_an_outside_change_and_echoes_the_last_known_time() {
    let vault = Vault::with_article("---\ntitle: Zen\n---\n載入時的正文\n");
    let loaded_at = vault.last_known_modified_at();
    vault.change_outside("---\ntitle: Zen\n---\nObsidian 的正文\n");

    let saved = vault.save("Rustle 的正文\n", &loaded_at, OutsideChanges::Refuse);

    assert_eq!(
        saved,
        Ok(SavedBody::ModifiedElsewhere {
            last_known_modified_at: loaded_at
        })
    );
    assert_eq!(vault.text(), "---\ntitle: Zen\n---\nObsidian 的正文\n");
}

#[test]
fn overwrites_an_outside_change_when_the_user_chose_to() {
    let vault = Vault::with_article("---\ntitle: Zen\n---\n載入時的正文\n");
    let loaded_at = vault.last_known_modified_at();
    vault.change_outside("---\ntitle: Zen\n---\nObsidian 的正文\n");

    let saved = vault.save("Rustle 的正文\n", &loaded_at, OutsideChanges::Overwrite);

    assert_eq!(
        saved,
        Ok(SavedBody::Saved {
            updated_at: SAVED_AT.to_owned(),
            last_known_modified_at: vault.last_known_modified_at(),
        })
    );
    assert_eq!(
        vault.text(),
        format!("---\ntitle: Zen\nupdated_at: {SAVED_AT}\n---\nRustle 的正文\n")
    );
}

#[test]
fn sends_the_outcome_and_camel_case_fields_to_the_webview() {
    let saved = SavedBody::Saved {
        updated_at: SAVED_AT.to_owned(),
        last_known_modified_at: "2026-08-20T08:04:12.000Z".to_owned(),
    };
    let modified_elsewhere = SavedBody::ModifiedElsewhere {
        last_known_modified_at: "2026-08-20T08:00:00.000Z".to_owned(),
    };

    assert_eq!(
        serde_json::to_value(&saved).expect("serializable"),
        json!({
            "outcome": "saved",
            "updatedAt": SAVED_AT,
            "lastKnownModifiedAt": "2026-08-20T08:04:12.000Z",
        })
    );
    assert_eq!(
        serde_json::to_value(&modified_elsewhere).expect("serializable"),
        json!({
            "outcome": "modifiedElsewhere",
            "lastKnownModifiedAt": "2026-08-20T08:00:00.000Z",
        })
    );
}
