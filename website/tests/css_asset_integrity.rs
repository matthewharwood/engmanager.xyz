#[path = "../build/asset_integrity.rs"]
mod asset_integrity;

#[test]
fn short_urls_cannot_alias_distinct_generation_bodies() {
    let old = format!("12345678{}", "0".repeat(56));
    let collision = format!("12345678{}", "1".repeat(56));
    let changed = format!("87654321{}", "1".repeat(56));
    assert!(
        asset_integrity::reject_short_hash_collision("/assets/css/test.12345678.css", &old, &old)
            .is_ok()
    );
    assert!(
        asset_integrity::reject_short_hash_collision(
            "/assets/css/test.12345678.css",
            &old,
            &changed
        )
        .is_ok()
    );
    assert!(
        asset_integrity::reject_short_hash_collision(
            "/assets/css/test.12345678.css",
            &old,
            &collision
        )
        .is_err()
    );
}

#[test]
fn archived_files_and_current_dist_pass_the_same_build_gate() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("compat");
    let dist = std::path::Path::new(env!("OUT_DIR"));
    asset_integrity::verify_compatibility_archives(
        &root,
        &dist.join("css-dist"),
        &dist.join("js-dist"),
    )
    .unwrap();
}
