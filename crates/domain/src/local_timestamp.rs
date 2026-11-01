use std::fmt;
use std::time::SystemTime;

use crate::utc_timestamp::UtcTimestamp;

const SECONDS_PER_MINUTE: i64 = 60;
const SECONDS_PER_HOUR: i64 = 3_600;

/// A point in time written as ISO 8601 in the writer's own time zone, e.g.
/// `2026-08-20T00:30:00+08:00`, so the date a person reads is their date.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct LocalTimestamp {
    utc: UtcTimestamp,
    offset_seconds: i32,
}

impl LocalTimestamp {
    pub fn new(time: SystemTime, offset_seconds: i32) -> Self {
        Self {
            utc: UtcTimestamp::from(time),
            offset_seconds,
        }
    }
}

impl fmt::Display for LocalTimestamp {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let utc_seconds = i64::try_from(self.utc.since_epoch().as_secs()).unwrap_or(i64::MAX);
        let local_seconds =
            u64::try_from(utc_seconds.saturating_add(i64::from(self.offset_seconds)))
                .unwrap_or_default();
        UtcTimestamp::write_date_time(formatter, local_seconds)?;
        let sign = if self.offset_seconds < 0 { '-' } else { '+' };
        let offset = i64::from(self.offset_seconds).abs();
        write!(
            formatter,
            "{sign}{:02}:{:02}",
            offset / SECONDS_PER_HOUR,
            offset % SECONDS_PER_HOUR / SECONDS_PER_MINUTE,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;
    use std::time::{Duration, UNIX_EPOCH};

    const TAIPEI: i32 = 8 * 3_600;

    fn at(utc_seconds: u64) -> SystemTime {
        UNIX_EPOCH + Duration::from_secs(utc_seconds)
    }

    #[rstest]
    #[case::after_local_midnight(1_787_157_000, TAIPEI, "2026-08-20T00:30:00+08:00")]
    #[case::utc(1_787_236_325, 0, "2026-08-20T14:32:05+00:00")]
    #[case::west_of_utc(1_787_236_325, -(4 * 3_600 + 30 * 60), "2026-08-20T10:02:05-04:30")]
    #[case::crosses_new_year(1_767_225_599, TAIPEI, "2026-01-01T07:59:59+08:00")]
    fn writes_the_local_time_with_its_offset(
        #[case] utc_seconds: u64,
        #[case] offset_seconds: i32,
        #[case] expected: &str,
    ) {
        assert_eq!(
            LocalTimestamp::new(at(utc_seconds), offset_seconds).to_string(),
            expected
        );
    }

    #[test]
    fn drops_the_milliseconds() {
        let time = at(1_787_236_325) + Duration::from_millis(999);

        assert_eq!(
            LocalTimestamp::new(time, 0).to_string(),
            "2026-08-20T14:32:05+00:00"
        );
    }
}
