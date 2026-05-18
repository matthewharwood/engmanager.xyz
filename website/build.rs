// Build-time asset pipeline.
//
// Two parallel passes:
//
//   1. CSS — every `*.css` in `website/css/src/` is parsed + minified by
//      lightningcss (selector merging, value shortening, dead-rule removal,
//      vendor-prefix dedup) and written to `$OUT_DIR/css-dist/{name}.css`.
//
//   2. JS  — every `*.js` in `website/js/src/` is parsed + compressed +
//      mangled by oxc_minifier (constant folding, DCE, variable renaming,
//      branch pruning) and written to `$OUT_DIR/js-dist/{name}.js`.
//
// Both output directories are picked up by rust-embed structs in main.rs
// (CssDist, JsDist). The runtime hashing layer (`asset_url`) maps
// `css/{name}` and `js/{name}` paths to content-addressed URLs.
//
// Over-the-wire brotli/gzip is handled at request time by the tower-http
// CompressionLayer in main.rs, so this build step only shrinks
// bytes-on-disk.

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use lightningcss::stylesheet::{
    MinifyOptions, ParserOptions, PrinterOptions, StyleSheet,
};
use oxc_allocator::Allocator;
use oxc_codegen::{Codegen, CodegenOptions, CommentOptions};
use oxc_mangler::MangleOptions;
use oxc_minifier::{CompressOptions, Minifier, MinifierOptions};
use oxc_parser::Parser;
use oxc_span::SourceType;

const CSS_SRC_DIR: &str = "css/src";
const CSS_DIST_SUBDIR: &str = "css-dist";
const JS_SRC_DIR: &str = "js/src";
const JS_DIST_SUBDIR: &str = "js-dist";

fn main() {
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR not set by cargo"));
    process_css(&out_dir);
    process_js(&out_dir);
}

fn process_css(out_dir: &Path) {
    println!("cargo:rerun-if-changed={CSS_SRC_DIR}");

    let dist_dir = out_dir.join(CSS_DIST_SUBDIR);
    fs::create_dir_all(&dist_dir)
        .unwrap_or_else(|e| panic!("create {}: {e}", dist_dir.display()));

    let src = PathBuf::from(CSS_SRC_DIR);
    if !src.exists() {
        return;
    }

    for entry in fs::read_dir(&src).unwrap_or_else(|e| panic!("read {}: {e}", src.display())) {
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

        let minified = minify_css(&css, &name);
        let out_path = dist_dir.join(&name);
        fs::write(&out_path, minified)
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn minify_css(source: &str, name: &str) -> Vec<u8> {
    let mut stylesheet = StyleSheet::parse(source, ParserOptions::default())
        .unwrap_or_else(|e| panic!("parse css {name}: {e:?}"));
    stylesheet
        .minify(MinifyOptions::default())
        .unwrap_or_else(|e| panic!("minify css {name}: {e:?}"));
    let result = stylesheet
        .to_css(PrinterOptions {
            minify: true,
            ..PrinterOptions::default()
        })
        .unwrap_or_else(|e| panic!("print css {name}: {e:?}"));
    result.code.into_bytes()
}

fn process_js(out_dir: &Path) {
    println!("cargo:rerun-if-changed={JS_SRC_DIR}");

    let dist_dir = out_dir.join(JS_DIST_SUBDIR);
    fs::create_dir_all(&dist_dir)
        .unwrap_or_else(|e| panic!("create {}: {e}", dist_dir.display()));

    let src = PathBuf::from(JS_SRC_DIR);
    if !src.exists() {
        return;
    }

    for entry in fs::read_dir(&src).unwrap_or_else(|e| panic!("read {}: {e}", src.display())) {
        let entry = entry.expect("read entry");
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("js") {
            continue;
        }
        println!("cargo:rerun-if-changed={}", path.display());

        let name = path
            .file_name()
            .expect("filename")
            .to_string_lossy()
            .into_owned();
        let source = fs::read_to_string(&path)
            .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));

        let minified = minify_js(&source, &path);
        let out_path = dist_dir.join(&name);
        fs::write(&out_path, minified)
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn minify_js(source: &str, path: &Path) -> String {
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::default());
    let allocator = Allocator::default();
    let parser_ret = Parser::new(&allocator, source, source_type).parse();
    if !parser_ret.errors.is_empty() {
        panic!("parse js {}: {:?}", path.display(), parser_ret.errors);
    }
    let mut program = parser_ret.program;

    // Mangle + maximum-compression DCE + constant folding. `smallest()`
    // runs the fixed-point compress loop until it converges.
    let minifier_options = MinifierOptions {
        mangle: Some(MangleOptions::default()),
        compress: Some(CompressOptions::smallest()),
    };
    let minifier_ret = Minifier::new(minifier_options).minify(&allocator, &mut program);

    Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            comments: CommentOptions::disabled(),
            ..CodegenOptions::default()
        })
        .with_scoping(minifier_ret.scoping)
        .build(&program)
        .code
}
