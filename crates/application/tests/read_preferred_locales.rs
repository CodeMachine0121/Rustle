use rustle_application::{PreferredLocales, ReadPreferredLocales};
use rustle_domain::MockLanguagePreferences;
use serde_json::json;

#[test]
fn answers_the_system_locales_most_preferred_first() {
    let mut preferences = MockLanguagePreferences::new();
    preferences
        .expect_preferred_locales()
        .return_const(vec!["ja-JP".to_owned(), "zh-Hant-TW".to_owned()]);

    let answer = ReadPreferredLocales::new(&preferences).execute();

    assert_eq!(
        answer,
        PreferredLocales {
            locales: vec!["ja-JP".to_owned(), "zh-Hant-TW".to_owned()]
        }
    );
    assert_eq!(
        serde_json::to_value(answer).expect("serializable"),
        json!({ "locales": ["ja-JP", "zh-Hant-TW"] })
    );
}
