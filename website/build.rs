// Build-time asset pipeline.
//
// Three deterministic passes:
//
//   1. CSS — every `*.css` in `website/css/src/` is parsed + minified by
//      lightningcss (selector merging, value shortening, dead-rule removal,
//      vendor-prefix dedup) and written to `$OUT_DIR/css-dist/{name}.css`.
//
//   2. JS  — every `*.js` in `website/js/src/` is parsed + compressed +
//      mangled by oxc_minifier (constant folding, DCE, variable renaming,
//      branch pruning) and written to `$OUT_DIR/js-dist/{name}.js`.
//
//   3. Components — every co-located `src/components/<feature>/style.css`
//      and `script.js` is emitted as `c-<feature>.css/js` into the same dist
//      dirs, so a component can declare its own runtime dependencies.
//
// Both output directories are picked up by rust-embed structs in main.rs
// (CssDist, JsDist). The runtime hashing layer (`asset_url`) maps
// `css/{name}` and `js/{name}` paths to content-addressed URLs.
// The dist dirs are wiped first; stale deleted assets never get embedded.
//
// Over-the-wire brotli/gzip is handled at request time by the tower-http
// CompressionLayer in main.rs, so this build step only shrinks
// bytes-on-disk.

use std::collections::HashSet;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};
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
// Co-located feature components live in `src/components/<feature>/`. Their
// `style.css` / `script.js` are discovered recursively and emitted into the
// SAME css-dist / js-dist dirs as the flat passes above, under `c-<feature>`
// names. Additive: the css/src + js/src passes are untouched, and output-name
// collisions fail the build instead of silently overwriting assets.
const COMPONENTS_SRC_DIR: &str = "src/components";
const COMPONENT_DIST_PREFIX: &str = "c-";

fn main() {
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR not set by cargo"));
    let css_dist = reset_dist_dir(&out_dir, CSS_DIST_SUBDIR);
    let js_dist = reset_dist_dir(&out_dir, JS_DIST_SUBDIR);
    let mut css_assets = HashSet::new();
    let mut js_assets = HashSet::new();

    process_css(&css_dist, &mut css_assets);
    process_js(&js_dist, &mut js_assets);
    process_components(&css_dist, &js_dist, &mut css_assets, &mut js_assets);
}

fn reset_dist_dir(out_dir: &Path, subdir: &str) -> PathBuf {
    let dist_dir = out_dir.join(subdir);
    if dist_dir.exists() {
        fs::remove_dir_all(&dist_dir)
            .unwrap_or_else(|e| panic!("remove {}: {e}", dist_dir.display()));
    }
    fs::create_dir_all(&dist_dir).unwrap_or_else(|e| panic!("create {}: {e}", dist_dir.display()));
    dist_dir
}

fn process_css(dist_dir: &Path, seen_assets: &mut HashSet<String>) {
    println!("cargo:rerun-if-changed={CSS_SRC_DIR}");

    let src = PathBuf::from(CSS_SRC_DIR);
    if !src.exists() {
        return;
    }

    for path in direct_child_files_with_extension(&src, "css") {
        println!("cargo:rerun-if-changed={}", path.display());

        let name = path
            .file_name()
            .expect("filename")
            .to_string_lossy()
            .into_owned();
        register_asset(seen_assets, &name, &path);
        let css =
            fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));

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

fn process_js(dist_dir: &Path, seen_assets: &mut HashSet<String>) {
    println!("cargo:rerun-if-changed={JS_SRC_DIR}");

    let src = PathBuf::from(JS_SRC_DIR);
    if !src.exists() {
        return;
    }

    for path in direct_child_files_with_extension(&src, "js") {
        println!("cargo:rerun-if-changed={}", path.display());

        let name = path
            .file_name()
            .expect("filename")
            .to_string_lossy()
            .into_owned();
        register_asset(seen_assets, &name, &path);
        let source =
            fs::read_to_string(&path).unwrap_or_else(|e| panic!("read {}: {e}", path.display()));

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

    let code = Codegen::new()
        .with_options(CodegenOptions {
            minify: true,
            comments: CommentOptions::disabled(),
            ..CodegenOptions::default()
        })
        .with_scoping(minifier_ret.scoping)
        .build(&program)
        .code;

    // Each file is served as its own classic script tag, which means
    // top-level `let`/`const` declarations share the page's global lexical
    // scope. Scope every emitted asset so common names like STORAGE_KEY or
    // ANIME_URL cannot collide across independently loaded scripts.
    format!("(()=>{{{code}\n}})();")
}

// Discover co-located feature-component assets under `src/components/<feature>/`
// and emit them into the SAME css-dist / js-dist dirs as the flat passes,
// reusing `minify_css` / `minify_js` verbatim (identical IIFE-wrap + parse-panic
// behavior). Dist names are `c-<feature>.{css,js}` (folder name, `_`->`-`);
// any duplicate output name fails the build before a file can be overwritten.
fn process_components(
    css_dist: &Path,
    js_dist: &Path,
    seen_css: &mut HashSet<String>,
    seen_js: &mut HashSet<String>,
) {
    println!("cargo:rerun-if-changed={COMPONENTS_SRC_DIR}");

    let root = PathBuf::from(COMPONENTS_SRC_DIR);
    if !root.exists() {
        return; // additive: no components yet -> no-op
    }

    for path in walk_files(&root) {
        let Some(feature) = component_feature_name(&path, &root) else {
            continue;
        };
        match path.extension().and_then(|s| s.to_str()) {
            Some("css") => {
                let name = format!("{COMPONENT_DIST_PREFIX}{feature}.css");
                register_asset(seen_css, &name, &path);
                println!("cargo:rerun-if-changed={}", path.display());
                let css = fs::read_to_string(&path)
                    .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
                let minified = minify_css(&css, &name);
                let out_path = css_dist.join(&name);
                fs::write(&out_path, minified)
                    .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
            }
            Some("js") => {
                let name = format!("{COMPONENT_DIST_PREFIX}{feature}.js");
                register_asset(seen_js, &name, &path);
                println!("cargo:rerun-if-changed={}", path.display());
                let source = fs::read_to_string(&path)
                    .unwrap_or_else(|e| panic!("read {}: {e}", path.display()));
                let minified = minify_js(&source, &path);
                let out_path = js_dist.join(&name);
                fs::write(&out_path, minified)
                    .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
            }
            _ => {}
        }
    }
}

fn direct_child_files_with_extension(root: &Path, extension: &str) -> Vec<PathBuf> {
    let mut files = fs::read_dir(root)
        .unwrap_or_else(|e| panic!("read {}: {e}", root.display()))
        .map(|entry| entry.expect("read entry").path())
        .filter(|path| path.extension().and_then(|s| s.to_str()) == Some(extension))
        .collect::<Vec<_>>();
    files.sort();
    files
}

fn register_asset(seen_assets: &mut HashSet<String>, name: &str, source: &Path) {
    assert!(
        seen_assets.insert(name.to_string()),
        "asset output collision for {name} from {}",
        source.display()
    );
}

// Depth-first recursive file walk (std-only, matching the project's fs idiom).
fn walk_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        for entry in fs::read_dir(&dir).unwrap_or_else(|e| panic!("read {}: {e}", dir.display())) {
            let entry = entry.expect("read entry");
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                out.push(path);
            }
        }
    }
    out.sort();
    out
}

// The immediate folder under `src/components` is the feature unit; underscores
// in the folder name become hyphens in the dist asset name (`to_top` ->
// `to-top`). Files directly in `src/components/` (e.g. mod.rs) return None.
fn component_feature_name(path: &Path, root: &Path) -> Option<String> {
    let parent = path.parent()?;
    let rel = parent.strip_prefix(root).ok()?;
    let first = rel.components().next()?;
    Some(first.as_os_str().to_string_lossy().replace('_', "-"))
}
