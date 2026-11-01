use std::io::{self, Write};
use std::path::Path;

use tempfile::NamedTempFile;

/// Writes to a temporary file in the same folder, flushes it to disk and
/// renames it over `path`, so readers never see a half-written file.
pub fn write_atomically(path: &Path, contents: &[u8]) -> io::Result<()> {
    let folder = path
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "path has no parent folder"))?;
    let mut temporary_file = NamedTempFile::new_in(folder)?;
    temporary_file.write_all(contents)?;
    temporary_file.as_file().sync_all()?;
    temporary_file.persist(path).map_err(|error| error.error)?;
    Ok(())
}
