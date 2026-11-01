use std::fmt;
use std::time::{SystemTime, UNIX_EPOCH};

const SECONDS_PER_DAY: u64 = 86_400;

/// A point in time written as ISO 8601 in UTC with milliseconds, e.g.
/// `2026-08-20T08:04:11.123Z`. Times before 1970 are written as the epoch.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct UtcTimestamp {
    milliseconds_since_epoch: u128,
}

impl From<SystemTime> for UtcTimestamp {
    fn from(time: SystemTime) -> Self {
        Self {
            milliseconds_since_epoch: time
                .duration_since(UNIX_EPOCH)
                .map(|elapsed| elapsed.as_millis())
                .unwrap_or_default(),
        }
    }
}

impl UtcTimestamp {
    /// Converts days since 1970-01-01 to a proleptic Gregorian date
    /// (Howard Hinnant's `civil_from_days`).
    fn civil_date(days_since_epoch: u64) -> (u64, u64, u64) {
        let shifted_days = days_since_epoch + 719_468;
        let era = shifted_days / 146_097;
        let day_of_era = shifted_days % 146_097;
        let year_of_era =
            (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
        let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
        let shifted_month = (5 * day_of_year + 2) / 153;
        let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
        let month = if shifted_month < 10 {
            shifted_month + 3
        } else {
            shifted_month - 9
        };
        let year = year_of_era + era * 400 + u64::from(month <= 2);
        (year, month, day)
    }
}

impl fmt::Display for UtcTimestamp {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        let milliseconds = self.milliseconds_since_epoch % 1_000;
        let seconds_since_epoch =
            u64::try_from(self.milliseconds_since_epoch / 1_000).map_err(|_| fmt::Error)?;
        let (year, month, day) = Self::civil_date(seconds_since_epoch / SECONDS_PER_DAY);
        let second_of_day = seconds_since_epoch % SECONDS_PER_DAY;
        write!(
            formatter,
            "{year:04}-{month:02}-{day:02}T{:02}:{:02}:{:02}.{milliseconds:03}Z",
            second_of_day / 3_600,
            second_of_day % 3_600 / 60,
            second_of_day % 60,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;
    use std::time::Duration;

    #[rstest]
    #[case::epoch(0, "1970-01-01T00:00:00.000Z")]
    #[case::leap_day(951_782_400_000, "2000-02-29T00:00:00.000Z")]
    #[case::end_of_year(1_767_225_599_999, "2025-12-31T23:59:59.999Z")]
    #[case::article_time(1_787_213_051_123, "2026-08-20T08:04:11.123Z")]
    fn writes_iso_8601_in_utc(#[case] milliseconds: u64, #[case] expected: &str) {
        let time = UNIX_EPOCH + Duration::from_millis(milliseconds);

        assert_eq!(UtcTimestamp::from(time).to_string(), expected);
    }

    #[test]
    fn writes_times_before_1970_as_the_epoch() {
        let time = UNIX_EPOCH - Duration::from_secs(1);

        assert_eq!(
            UtcTimestamp::from(time).to_string(),
            "1970-01-01T00:00:00.000Z"
        );
    }
}
