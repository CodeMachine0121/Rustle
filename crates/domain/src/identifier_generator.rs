#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait IdentifierGenerator {
    /// An identifier no earlier call has returned.
    fn generate(&self) -> String;
}
