use std::time::SystemTime;

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait Clock {
    fn now(&self) -> SystemTime;
}
