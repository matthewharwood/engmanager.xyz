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
//      dirs, so a component can declare its own runtime dependencies. The
//      dist names are also generated into `$OUT_DIR/component_assets.rs`
//      (one `pub mod <feature>` of `STYLE`/`SCRIPT` consts), included by
//      `src/components/mod.rs`, so a renamed folder fails compilation
//      instead of 404ing at runtime.
//
// The passes are PLANNED single-threaded — sorted file lists, one collision
// namespace per dist dir across all passes, cargo directives, the generated
// consts file — then the three minify workloads run in parallel via
// `std::thread::scope`. Every output file is written exactly once from
// pre-registered names, so parallelism cannot change the emitted bytes.
//
// Both output directories are picked up by rust-embed structs in main.rs
// (CssDist, JsDist). The runtime hashing layer (`asset_url`) maps
// `css/{name}` and `js/{name}` paths to content-addressed URLs.
// The dist dirs are wiped first; stale deleted assets never get embedded.
//
// Over-the-wire brotli/gzip is handled at request time by the tower-http
// CompressionLayer in main.rs, so this build step only shrinks
// bytes-on-disk.

use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

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
// `style.css` / `script.js` are discovered and emitted into the SAME css-dist
// / js-dist dirs as the flat passes above, under `c-<feature>` names.
// Additive: the css/src + js/src passes are untouched, and output-name
// collisions fail the build instead of silently overwriting assets.
const COMPONENTS_SRC_DIR: &str = "src/components";
const COMPONENT_DIST_PREFIX: &str = "c-";
// The component filename contract: these EXACT names, directly inside the
// feature folder, are the only css/js files a component may carry.
const COMPONENT_STYLE_FILE: &str = "style.css";
const COMPONENT_SCRIPT_FILE: &str = "script.js";
// Generated consts file include!d by `src/components/mod.rs`.
const COMPONENT_ASSETS_RS: &str = "component_assets.rs";

/// One minify job: a source file plus its pre-registered dist file name.
struct Job {
    src: PathBuf,
    out_name: String,
}

/// Which of the two contract files a component folder actually contains;
/// drives which consts its generated `asset_names` module exposes.
#[derive(Default)]
struct ComponentAssets {
    style: bool,
    script: bool,
}

fn main() {
    let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("OUT_DIR not set by cargo"));
    let css_dist = reset_dist_dir(&out_dir, CSS_DIST_SUBDIR);
    let js_dist = reset_dist_dir(&out_dir, JS_DIST_SUBDIR);

    // Plan single-threaded: deterministic sorted file lists, ONE collision
    // namespace per dist dir spanning the flat AND component passes, and all
    // cargo directives (println! must never interleave across threads).
    let mut css_assets = HashSet::new();
    let mut js_assets = HashSet::new();
    let css_jobs = plan_flat_pass(CSS_SRC_DIR, "css", &mut css_assets);
    let js_jobs = plan_flat_pass(JS_SRC_DIR, "js", &mut js_assets);
    let (component_css_jobs, component_js_jobs, features) =
        plan_components(&mut css_assets, &mut js_assets);

    // Always written (even with zero components): components/mod.rs
    // include!s it unconditionally.
    write_component_assets_rs(&out_dir, &features);

    // Minify in parallel — names are already registered and collision-checked,
    // so each thread only reads sources and writes its own pre-claimed files.
    thread::scope(|scope| {
        let handles = [
            scope.spawn(|| run_css_jobs(&css_jobs, &css_dist)),
            scope.spawn(|| run_js_jobs(&js_jobs, &js_dist)),
            scope.spawn(|| {
                run_css_jobs(&component_css_jobs, &css_dist);
                run_js_jobs(&component_js_jobs, &js_dist);
            }),
        ];
        for handle in handles {
            if let Err(panic) = handle.join() {
                std::panic::resume_unwind(panic);
            }
        }
    });
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

// Plan a flat pass: every direct-child `*.{extension}` of `src_dir` keeps its
// own basename in the dist dir. The dir-level rerun-if-changed watch is
// recursive, so no per-file lines are needed — and none is emitted when the
// dir doesn't exist (cargo treats a watched-but-missing path as always dirty,
// which would rebuild on every run).
fn plan_flat_pass(src_dir: &str, extension: &str, seen_assets: &mut HashSet<String>) -> Vec<Job> {
    let src = PathBuf::from(src_dir);
    if !src.exists() {
        return Vec::new();
    }
    println!("cargo:rerun-if-changed={src_dir}");

    direct_child_files_with_extension(&src, extension)
        .into_iter()
        .map(|path| {
            let name = path
                .file_name()
                .expect("filename")
                .to_string_lossy()
                .into_owned();
            register_asset(seen_assets, &name, &path);
            Job {
                src: path,
                out_name: name,
            }
        })
        .collect()
}

// Plan the component pass: discover `src/components/<feature>/style.css` /
// `script.js`, register their `c-<feature>` dist names in the SAME collision
// namespaces as the flat passes, and record per-feature which consts the
// generated `component_assets.rs` must expose.
//
// Filename contract (enforced, not skipped-over): the ONLY css/js files
// allowed anywhere under `src/components/` are exactly
// `<feature>/style.css` and `<feature>/script.js`. Any other `*.css`/`*.js`
// — wrong name, nested deeper, or directly in `src/components/` — panics
// naming the file, so a typo'd `styles.css` fails the build instead of
// silently shipping nothing.
fn plan_components(
    seen_css: &mut HashSet<String>,
    seen_js: &mut HashSet<String>,
) -> (Vec<Job>, Vec<Job>, BTreeMap<String, ComponentAssets>) {
    let mut css_jobs = Vec::new();
    let mut js_jobs = Vec::new();
    let mut features: BTreeMap<String, ComponentAssets> = BTreeMap::new();

    let root = PathBuf::from(COMPONENTS_SRC_DIR);
    if !root.exists() {
        return (css_jobs, js_jobs, features); // additive: no components yet
    }
    println!("cargo:rerun-if-changed={COMPONENTS_SRC_DIR}");

    for path in walk_files(&root) {
        let is_css = path.extension().and_then(|s| s.to_str()) == Some("css");
        let is_js = path.extension().and_then(|s| s.to_str()) == Some("js");
        if !is_css && !is_js {
            continue; // mod.rs and friends
        }

        let rel = path.strip_prefix(&root).expect("walked file under root");
        let expected = if is_css {
            COMPONENT_STYLE_FILE
        } else {
            COMPONENT_SCRIPT_FILE
        };
        let file_name = path.file_name().expect("filename").to_string_lossy();
        if rel.components().count() != 2 || file_name != expected {
            panic!(
                "component asset contract violation at {}: the only css/js files \
                 allowed under {COMPONENTS_SRC_DIR}/ are exactly \
                 <feature>/{COMPONENT_STYLE_FILE} and <feature>/{COMPONENT_SCRIPT_FILE} \
                 (emitted as {COMPONENT_DIST_PREFIX}<feature> dist assets); \
                 rename or relocate this file",
                path.display()
            );
        }

        let folder = rel
            .components()
            .next()
            .expect("feature folder")
            .as_os_str()
            .to_string_lossy()
            .into_owned();
        // Underscores in the folder name become hyphens in the dist asset
        // name (`to_top` -> `c-to-top.css`); the folder name itself is the
        // generated module ident.
        let dist_feature = folder.replace('_', "-");
        let entry = features.entry(folder).or_default();
        if is_css {
            let name = format!("{COMPONENT_DIST_PREFIX}{dist_feature}.css");
            register_asset(seen_css, &name, &path);
            entry.style = true;
            css_jobs.push(Job {
                src: path,
                out_name: name,
            });
        } else {
            let name = format!("{COMPONENT_DIST_PREFIX}{dist_feature}.js");
            register_asset(seen_js, &name, &path);
            entry.script = true;
            js_jobs.push(Job {
                src: path,
                out_name: name,
            });
        }
    }

    (css_jobs, js_jobs, features)
}

// Generate `$OUT_DIR/component_assets.rs`: one `pub mod <feature>` per
// component folder, exposing only the consts whose source file exists. The
// names are derived from the same scan that emits the dist assets, so the
// Rust side can never drift from the build output — a renamed folder breaks
// the component's `pub use` at compile time instead of 404ing in production.
fn write_component_assets_rs(out_dir: &Path, features: &BTreeMap<String, ComponentAssets>) {
    let mut src =
        String::from("// @generated by build.rs — dist asset names for co-located components.\n");
    for (folder, assets) in features {
        let dist_feature = folder.replace('_', "-");
        let _ = writeln!(src, "pub mod {folder} {{");
        if assets.style {
            let _ = writeln!(
                src,
                "    pub const STYLE: &str = \"css/{COMPONENT_DIST_PREFIX}{dist_feature}.css\";"
            );
        }
        if assets.script {
            let _ = writeln!(
                src,
                "    pub const SCRIPT: &str = \"js/{COMPONENT_DIST_PREFIX}{dist_feature}.js\";"
            );
        }
        let _ = writeln!(src, "}}");
    }

    let path = out_dir.join(COMPONENT_ASSETS_RS);
    fs::write(&path, src).unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
}

fn run_css_jobs(jobs: &[Job], dist_dir: &Path) {
    for job in jobs {
        let css = fs::read_to_string(&job.src)
            .unwrap_or_else(|e| panic!("read {}: {e}", job.src.display()));
        let minified = minify_css(&css, &job.src);
        let out_path = dist_dir.join(&job.out_name);
        fs::write(&out_path, minified)
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn run_js_jobs(jobs: &[Job], dist_dir: &Path) {
    for job in jobs {
        let source = fs::read_to_string(&job.src)
            .unwrap_or_else(|e| panic!("read {}: {e}", job.src.display()));
        let minified = minify_js(&source, &job.src);
        let out_path = dist_dir.join(&job.out_name);
        fs::write(&out_path, minified)
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn minify_css(source: &str, src_path: &Path) -> Vec<u8> {
    let filename = src_path.display().to_string();
    // Thread the source filename through ParserOptions so every error's
    // location renders as `file:line:column` (lightningcss Display includes
    // the location when present).
    let mut stylesheet = StyleSheet::parse(
        source,
        ParserOptions {
            filename: filename.clone(),
            ..ParserOptions::default()
        },
    )
    .unwrap_or_else(|e| panic!("parse css {filename}: {e}"));
    stylesheet
        .minify(MinifyOptions::default())
        .unwrap_or_else(|e| panic!("minify css {filename}: {e}"));
    let result = stylesheet
        .to_css(PrinterOptions {
            minify: true,
            ..PrinterOptions::default()
        })
        .unwrap_or_else(|e| panic!("print css {filename}: {e}"));
    result.code.into_bytes()
}

fn minify_js(source: &str, path: &Path) -> String {
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::default());
    let allocator = Allocator::default();
    let parser_ret = Parser::new(&allocator, source, source_type).parse();
    if !parser_ret.errors.is_empty() {
        // Render each diagnostic through miette's report (`with_source_code`
        // attaches the source for a labeled snippet with line/column); the
        // panic line carries the file name for all of them.
        let rendered: String = parser_ret
            .errors
            .into_iter()
            .map(|diagnostic| format!("{:?}\n", diagnostic.with_source_code(source.to_string())))
            .collect();
        panic!("parse js {}:\n{rendered}", path.display());
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
