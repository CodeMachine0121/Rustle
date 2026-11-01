use std::time::SystemTime;

#[cfg_attr(any(test, feature = "mocks"), mockall::automock)]
pub trait Clock {
    fn now(&self) -> SystemTime;

    /// How many seconds the machine's local time is ahead of UTC at `time`.
    fn local_offset_seconds(&self, time: SystemTime) -> i32;
}
