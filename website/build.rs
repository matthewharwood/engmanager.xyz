// CSS bundle pipeline.
//
// For each `*.css` source under `website/css/src/`, parse with lightningcss,
// run its minifier (selector merging, value shortening, dead-rule removal,
// vendor-prefix dedup), then emit the minified bytes to
// `$OUT_DIR/css-dist/{name}.css`. The main crate's `CssDist` rust-embed
// picks them up from there, and `asset_url("css/{name}.css")` produces a
// content-hashed URL (`/assets/css/{name}.{hash}.css`) thanks to the
// existing runtime hashing layer in `main.rs`.
//
// Over-the-wire compression (brotli/gzip) is handled at request time by
// the tower-http CompressionLayer in main.rs, so this build step only
// shrinks bytes-on-disk via minification.

use std::env;
use std::fs;
use std::path::PathBuf;

use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};

const SRC_DIR: &str = "css/src";
const DIST_SUBDIR: &str = "css-dist";

fn main() {
    println!("cargo:rerun-if-changed={SRC_DIR}");

    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR not set by cargo"));
    let dist_dir = out_dir.join(DIST_SUBDIR);
    fs::create_dir_all(&dist_dir).unwrap_or_else(|e| {
        panic!("create {}: {e}", dist_dir.display());
    });

    let src = PathBuf::from(SRC_DIR);
    if !src.exists() {
        // First-build seed: the dist directory must exist for rust-embed even
        // if there are no source files yet. We've already created it above.
        return;
    }

    let entries = fs::read_dir(&src).unwrap_or_else(|e| panic!("read {}: {e}", src.display()));
    for entry in entries {
        let entry = entry.expect("read entry");
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("css") {
            continue;
        }
        println!("cargo:rerun-if-changed={}", path.display());

        let name = path
            .file_name()
            .expect("filename")
            .to_string_lossy()
            .into_owned();
        let css = fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));

        let minified = minify(&css, &name);
        let out_path = dist_dir.join(&name);
        fs::write(&out_path, minified).unwrap_or_else(|e| {
            panic!("write {}: {e}", out_path.display());
        });
    }
}

fn minify(source: &str, name: &str) -> Vec<u8> {
    let mut stylesheet = StyleSheet::parse(source, ParserOptions::default())
        .unwrap_or_else(|e| panic!("parse {name}: {e:?}"));
    stylesheet
        .minify(MinifyOptions::default())
        .unwrap_or_else(|e| panic!("minify {name}: {e:?}"));
    let result = stylesheet
        .to_css(PrinterOptions {
            minify: true,
            ..PrinterOptions::default()
        })
        .unwrap_or_else(|e| panic!("print {name}: {e:?}"));
    result.code.into_bytes()
}
