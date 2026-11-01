use rustle_domain::IdentifierGenerator;
use rustle_infrastructure::UuidGenerator;

#[test]
fn generates_a_different_random_uuid_each_time() {
    let first = UuidGenerator.generate();
    let second = UuidGenerator.generate();

    assert_ne!(first, second);
    for identifier in [&first, &second] {
        assert_eq!(identifier.len(), 36);
        assert_eq!(identifier.chars().nth(14), Some('4'));
        assert!(
            identifier
                .chars()
                .all(|character| character == '-' || character.is_ascii_hexdigit())
        );
    }
}
