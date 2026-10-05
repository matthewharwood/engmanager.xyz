//! Verify legacy immutable bodies once, and reject short-URL hash collisions.
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

pub fn reject_short_hash_collision(url: &str, old: &str, current: &str) -> Result<(), String> {
    if old.len() != 64 || current.len() != 64 {
        return Err(format!("invalid full digest for {url}"));
    }
    if old[..8] == current[..8] && old != current {
        return Err(format!(
            "{url} would identify two different full SHA-256 bodies"
        ));
    }
    Ok(())
}

pub fn verify_compatibility_assets(root: &Path, css: &Path, js: &Path) -> Result<(), String> {
    let manifest: serde_json::Value = serde_json::from_slice(
        &fs::read(root.join("manifest.json")).map_err(|error| error.to_string())?,
    )
    .map_err(|error| error.to_string())?;
    let entries = manifest["assets"]
        .as_array()
        .ok_or("missing compatibility assets")?;
    for entry in entries {
        let url = entry["path"].as_str().ok_or("missing compatibility URL")?;
        let file = entry["file"].as_str().ok_or("missing compatibility file")?;
        let expected = entry["sha256"]
            .as_str()
            .ok_or("missing compatibility SHA")?;
        if file != url.trim_start_matches('/')
            || !(url.starts_with("/assets/css/") || url.starts_with("/assets/js/"))
        {
            return Err(format!("invalid compatibility path {url}"));
        }
        let body = fs::read(root.join(file)).map_err(|error| format!("{url}: {error}"))?;
        let digest = format!("{:x}", Sha256::digest(&body));
        if digest != expected || entry["bytes"].as_u64() != Some(body.len() as u64) {
            return Err(format!("archived body differs from full SHA/length: {url}"));
        }
        let (directory, filename) = if let Some(filename) = url.strip_prefix("/assets/css/") {
            (css, filename)
        } else {
            (
                js,
                url.strip_prefix("/assets/js/").expect("validated prefix"),
            )
        };
        let (stem_hash, extension) = filename.rsplit_once('.').ok_or("missing extension")?;
        let (stem, short) = stem_hash.rsplit_once('.').ok_or("missing URL hash")?;
        if short != &digest[..8] {
            return Err(format!("archived URL differs from body SHA: {url}"));
        }
        let current = directory.join(format!("{stem}.{extension}"));
        if current.exists() {
            let body = fs::read(current).map_err(|error| error.to_string())?;
            let current_digest = format!("{:x}", Sha256::digest(body));
            reject_short_hash_collision(url, &digest, &current_digest)?;
        }
    }
    Ok(())
}

pub fn verify_compatibility_archives(root: &Path, css: &Path, js: &Path) -> Result<(), String> {
    let mut historical: BTreeMap<String, String> = BTreeMap::new();
    for directory in ["css-generation-2061afa3", "css-generation-c65689df"] {
        let archive = root.join(directory);
        verify_compatibility_assets(&archive, css, js)?;
        let manifest: serde_json::Value = serde_json::from_slice(
            &fs::read(archive.join("manifest.json")).map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
        for entry in manifest["assets"]
            .as_array()
            .expect("verified asset entries")
        {
            let url = entry["path"].as_str().expect("verified asset URL");
            let digest = entry["sha256"].as_str().expect("verified asset SHA");
            if let Some(previous) = historical.get(url) {
                reject_short_hash_collision(url, previous, digest)?;
            } else {
                historical.insert(url.to_owned(), digest.to_owned());
            }
        }
    }
    Ok(())
}
