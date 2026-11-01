use std::fs;
use std::io::{self, Write};
use std::path::Path;

use rustle_domain::{ArticleWrite, UtcTimestamp};
use tempfile::NamedTempFile;

const TEMPORARY_FILE_SUFFIX: &str = ".rustle-temporary";

/// Writes to a temporary file in the same folder, flushes it to disk and
/// renames it over `path`, so readers never see a half-written file. A
/// replaced file keeps its permissions; on Unix the folder is flushed too,
/// so the rename survives a power loss.
pub fn write_atomically(path: &Path, contents: &[u8]) -> io::Result<()> {
    PreparedReplacement::new(path, contents)?.replace()?;
    Ok(())
}

/// [`write_atomically`], but only while `path` still has the modification
/// time the caller expects. It is checked before the temporary file is
/// written and again right before the rename. The returned modification
/// time is taken from the temporary file, which the rename keeps, so a
/// file already in place is never reported as unwritten for want of it.
pub(crate) fn write_atomically_unless_modified(
    path: &Path,
    contents: &[u8],
    expected_modified_at: &str,
) -> io::Result<ArticleWrite> {
    write_atomically_unless_modified_pausing(path, contents, expected_modified_at, || {})
}

fn write_atomically_unless_modified_pausing(
    path: &Path,
    contents: &[u8],
    expected_modified_at: &str,
    before_replace: impl FnOnce(),
) -> io::Result<ArticleWrite> {
    if modified_at(path)? != expected_modified_at {
        return Ok(ArticleWrite::ModifiedElsewhere);
    }
    let replacement = PreparedReplacement::new(path, contents)?;
    before_replace();
    if modified_at(path)? != expected_modified_at {
        return Ok(ArticleWrite::ModifiedElsewhere);
    }
    let modified_at = replacement.replace()?;
    Ok(ArticleWrite::Written { modified_at })
}

fn modified_at(path: &Path) -> io::Result<String> {
    let modified = fs::metadata(path)?.modified()?;
    Ok(UtcTimestamp::from(modified).to_string())
}

/// A fully written and flushed temporary file next to its target. Dropping
/// it without [`replace`](Self::replace) deletes it.
struct PreparedReplacement<'a> {
    path: &'a Path,
    folder: &'a Path,
    temporary_file: NamedTempFile,
    modified_at: String,
}

impl<'a> PreparedReplacement<'a> {
    fn new(path: &'a Path, contents: &[u8]) -> io::Result<Self> {
        let invalid_path = || io::Error::new(io::ErrorKind::InvalidInput, "path has no file name");
        let folder = path.parent().ok_or_else(invalid_path)?;
        let file_name = path.file_name().ok_or_else(invalid_path)?;
        let mut temporary_file = tempfile::Builder::new()
            .prefix(&format!(".{}.", file_name.to_string_lossy()))
            .suffix(TEMPORARY_FILE_SUFFIX)
            .tempfile_in(folder)?;
        temporary_file.write_all(contents)?;
        if let Ok(existing) = fs::metadata(path) {
            temporary_file
                .as_file()
                .set_permissions(existing.permissions())?;
        }
        temporary_file.as_file().sync_all()?;
        let modified = temporary_file.as_file().metadata()?.modified()?;
        Ok(Self {
            path,
            folder,
            temporary_file,
            modified_at: UtcTimestamp::from(modified).to_string(),
        })
    }

    /// Returns the replaced file's modification time.
    fn replace(self) -> io::Result<String> {
        self.temporary_file
            .persist(self.path)
            .map_err(|error| error.error)?;
        #[cfg(unix)]
        fs::File::open(self.folder)?.sync_all()?;
        Ok(self.modified_at)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn refuses_when_another_program_writes_between_the_check_and_the_rename() {
        let directory = TempDir::new().expect("temporary directory");
        let path = directory.path().join("article.md");
        fs::write(&path, "loaded body").expect("existing file");
        let loaded_at = modified_at(&path).expect("modification time");
        let later = fs::metadata(&path)
            .and_then(|metadata| metadata.modified())
            .expect("modification time")
            + std::time::Duration::from_secs(5);

        let outcome =
            write_atomically_unless_modified_pausing(&path, b"rustle body", &loaded_at, || {
                fs::write(&path, "other program's body").expect("outside write");
                fs::File::options()
                    .write(true)
                    .open(&path)
                    .and_then(|file| file.set_modified(later))
                    .expect("modification time set");
            })
            .expect("no failure");

        assert_eq!(outcome, ArticleWrite::ModifiedElsewhere);
        assert_eq!(
            fs::read_to_string(&path).expect("readable"),
            "other program's body"
        );
        assert_eq!(
            fs::read_dir(directory.path()).expect("listable").count(),
            1,
            "no temporary file is left behind"
        );
    }

    #[test]
    fn reports_the_modification_time_the_written_file_has_on_disk() {
        let directory = TempDir::new().expect("temporary directory");
        let path = directory.path().join("article.md");
        fs::write(&path, "loaded body").expect("existing file");
        let loaded_at = modified_at(&path).expect("modification time");

        let outcome =
            write_atomically_unless_modified(&path, b"rustle body", &loaded_at).expect("written");

        assert_eq!(
            outcome,
            ArticleWrite::Written {
                modified_at: modified_at(&path).expect("modification time"),
            }
        );
        assert_eq!(fs::read_to_string(&path).expect("readable"), "rustle body");
    }
}
