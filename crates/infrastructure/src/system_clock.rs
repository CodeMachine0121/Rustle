use std::time::SystemTime;

use rustle_domain::Clock;

#[derive(Debug, Clone, Copy, Default)]
pub struct SystemClock;

impl Clock for SystemClock {
    fn now(&self) -> SystemTime {
        SystemTime::now()
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
}
