use rustle_domain::IdentifierGenerator;
use uuid::Uuid;

/// Random (version 4) UUIDs.
#[derive(Debug, Clone, Copy, Default)]
pub struct UuidGenerator;

impl IdentifierGenerator for UuidGenerator {
    fn generate(&self) -> String {
        Uuid::new_v4().to_string()
    }
}
