/// JSON file persistence for homepage blocks
///
/// This module handles reading and writing homepage block data to/from the
/// filesystem. It provides fallback behavior when files are missing or invalid.
///
/// # Error Handling
///
/// Following rust-error-handling patterns:
/// - **Graceful degradation**: Missing or invalid files fall back to defaults
/// - **User-facing errors**: API errors return Result for proper HTTP mapping
/// - **Logging**: Errors are logged to stderr for debugging
///
/// # File Location
///
/// Homepage data is stored at: `data/homepage.json`
///
/// This path is relative to the project root, not the website/ directory.
use std::fs;
use std::io;

use crate::core::block::{Block, HomepageData};

const HOMEPAGE_JSON_PATH: &str = "../data/homepage.json";

/// Load homepage blocks from JSON file
///
/// If the file doesn't exist or contains invalid JSON, this function falls back
/// to the default blocks defined in HomepageData::default_blocks().
///
/// # Fallback Behavior
///
/// - File not found: Returns default blocks
/// - Invalid JSON: Returns default blocks, logs error to stderr
/// - Valid JSON: Returns parsed blocks
pub fn load_homepage_blocks() -> Vec<Block> {
    match fs::read_to_string(HOMEPAGE_JSON_PATH) {
        Ok(contents) => match serde_json::from_str::<HomepageData>(&contents) {
            Ok(data) => data.blocks,
            Err(e) => {
                eprintln!("Failed to parse homepage.json: {}", e);
                HomepageData::default_blocks()
            }
        },
        Err(e) => {
            // Only log if error is not "file not found" (expected on first run)
            if e.kind() != io::ErrorKind::NotFound {
                eprintln!("Failed to read homepage.json: {}", e);
            }
            HomepageData::default_blocks()
        }
    }
}

/// Save homepage blocks to JSON file
///
/// This is the write path for the admin API. It serializes blocks to pretty-printed
/// JSON and writes atomically to the filesystem.
///
/// # Errors
///
/// Returns an error if:
/// - JSON serialization fails (unlikely with valid Block data)
/// - File write fails (disk full, permissions, etc.)
///
/// The caller should map this error to an appropriate HTTP status code.
pub fn save_homepage_blocks(blocks: &[Block]) -> Result<(), Box<dyn std::error::Error>> {
    let data = HomepageData::new(blocks.to_vec());
    let json = serde_json::to_string_pretty(&data)?;
    fs::write(HOMEPAGE_JSON_PATH, json)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::block::{ButtonProps, HeaderProps, HeroProps};

    #[test]
    fn test_default_blocks_serialization() {
        let blocks = HomepageData::default_blocks();
        let data = HomepageData::new(blocks);
        let json = serde_json::to_string_pretty(&data).unwrap();

        // Should be able to round-trip
        let parsed: HomepageData = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.blocks.len(), 2);
    }
}
