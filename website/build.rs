// Build-time application asset pipeline.
//
// Plan the whole project once: ordinary CSS sources, explicit Rust/JavaScript
// class bindings, actual Markdown HTML, dynamic identity tokens, and preserved
// external names. lightningcss-compact selects and minifies one deterministic
// class plan while retaining each stylesheet's existing delivery boundary.
//
// Emit compiled Rust literals and Markdown plus portable input/output manifests
// tied to the CSS generation. CSS jobs write the already optimized stylesheet
// results. JavaScript jobs replace parsed bindings before Oxc compression and
// mangling; no runtime class map is delivered.
//
// Flat css/src and js/src assets and co-located component style.css/script.js
// share collision-checked output namespaces. Planning, cargo directives, and
// component_assets.rs generation are single-threaded and sorted. The independent
// emission jobs then run in parallel, with exactly one writer per output file.
//
// RustEmbed consumes $OUT_DIR/css-dist and js-dist; runtime asset_url produces
// verified content-addressed URLs. Both directories are cleared before emission.
// A final full-SHA compatibility gate validates frozen legacy bytes and rejects
// short-URL collisions. HTTP Brotli/gzip remains the CompressionLayer's job.

use std::collections::{BTreeMap, HashSet};
use std::env;
use std::fmt::Write as _;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;

#[path = "build/asset_integrity.rs"]
mod asset_integrity;
#[path = "build/compact.rs"]
mod compact;
#[path = "build/shaders.rs"]
mod shaders;
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
    println!("cargo:rerun-if-changed=compat/css-generation-2061afa3");
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

    let css_inventory = css_jobs
        .iter()
        .chain(&component_css_jobs)
        .map(|job| (job.src.clone(), job.out_name.clone()))
        .collect::<Vec<_>>();
    let js_inventory = js_jobs
        .iter()
        .chain(&component_js_jobs)
        .map(|job| job.src.clone())
        .collect::<Vec<_>>();
    let adapter = compact::Adapter::collect(&css_inventory, &js_inventory);
    let compiled = adapter.compile();
    adapter.emit(&compiled, &out_dir);

    // Minify in parallel — names are already registered and collision-checked,
    // so each thread only reads sources and writes its own pre-claimed files.
    thread::scope(|scope| {
        let handles = [
            scope.spawn(|| run_css_jobs(&css_jobs, &css_dist, &compiled)),
            scope.spawn(|| run_js_jobs(&js_jobs, &js_dist, &adapter, &compiled)),
            scope.spawn(|| {
                run_css_jobs(&component_css_jobs, &css_dist, &compiled);
                run_js_jobs(&component_js_jobs, &js_dist, &adapter, &compiled);
            }),
        ];
        for handle in handles {
            if let Err(panic) = handle.join() {
                std::panic::resume_unwind(panic);
            }
        }
    });
    asset_integrity::verify_compatibility_assets(
        Path::new("compat/css-generation-2061afa3"),
        &css_dist,
        &js_dist,
    )
    .unwrap_or_else(|error| panic!("compatibility asset integrity: {error}"));
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

fn run_css_jobs(jobs: &[Job], dist_dir: &Path, compiled: &lightningcss_compact::CompiledProject) {
    for job in jobs {
        let out_path = dist_dir.join(&job.out_name);
        fs::write(&out_path, &compiled.stylesheets[&job.out_name])
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn run_js_jobs(
    jobs: &[Job],
    dist_dir: &Path,
    adapter: &compact::Adapter,
    compiled: &lightningcss_compact::CompiledProject,
) {
    for job in jobs {
        let source = fs::read_to_string(&job.src)
            .unwrap_or_else(|e| panic!("read {}: {e}", job.src.display()));
        let transformed = adapter.javascript(&job.src, &source, compiled);
        let transformed = shaders::compact_literals(&transformed, &job.src);
        let minified = minify_js(&transformed, &job.src);
        let out_path = dist_dir.join(&job.out_name);
        fs::write(&out_path, minified)
            .unwrap_or_else(|e| panic!("write {}: {e}", out_path.display()));
    }
}

fn minify_js(source: &str, path: &Path) -> String {
    // The emitted assets already have this private lexical scope. Establish
    // it before compression so Oxc can remove source-only CSS binding helpers
    // and mangle private top-level declarations instead of preserving globals.
    // The newline also keeps a trailing source comment from swallowing `}`.
    let source = format!("(()=>{{{source}\n}})();");
    let source_type = SourceType::from_path(path).unwrap_or_else(|_| SourceType::default());
    let allocator = Allocator::default();
    let parser_ret = Parser::new(&allocator, &source, source_type).parse();
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
