use std::time::SystemTime;

use chrono::{DateTime, Local};

use rustle_domain::Clock;

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> SystemTime {
        SystemTime::now()
    }

    fn local_offset_seconds(&self, time: SystemTime) -> i32 {
        DateTime::<Local>::from(time).offset().local_minus_utc()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tells_the_current_time() {
        let before = SystemTime::now();

        let now = SystemClock.now();

        assert!(before <= now && now <= SystemTime::now());
    }

    #[test]
    fn tells_a_local_offset_within_a_day_of_utc() {
        let offset = SystemClock.local_offset_seconds(SystemTime::now());

        assert!(offset.abs() < 24 * 3_600);
    }
}
