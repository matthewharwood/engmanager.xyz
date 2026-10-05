# Website CSS compilation

Application styles stay in `website/css` as ordinary CSS. `website/build/compact.rs` inventories explicit Rust, JavaScript, and Markdown bindings, then calls the public `lightningcss-compact` library. Every stylesheet stays in its existing asset and loading boundary. Published personality releases, vendor namespaces, email markup, and self-contained error/offline documents retain their identities.

Before publication, the website consumes the external repository at
`https://github.com/eng-manager-xyz/lightningcss-compact`, pinned to
`c6be50175cfb3995c9c9b82f3991900a0a251066`. This integration proves the package
without a sibling checkout or path dependency. After both repositories pass
their checks and crate `0.1.0` is published, replace the Git dependency with
the exact registry version `=0.1.0` and validate that final dependency again.

Rust view attributes use literal bindings:

```rust
view! { <article class={classes!("article article-featured")} /> }
let state = token!("is-active");
let query = selector!(".article > .article-featured");
let fragment = css_html!(r#"<span class="article-featured">Featured</span>"#);
```

Pass explicit named arguments to `format!` when its format literal comes from `css_html!`: macro expansion cannot capture local variables implicitly. Generated macros accept only literals found by the build inventory; they do not resolve names at runtime.

JavaScript uses `cssClasses("article")`, `cssSelector(".article")`, `cssToken("is-active")`, and `cssHtml('<span class="article">…</span>')`. The adapter parses their AST call sites and replaces them before Oxc minification. Source-only identity functions keep direct source tests runnable; dead-code elimination removes them from delivered bundles. Use `cssToken` for independently added, removed, toggled, or externally controlled classes. DOM copied from an already compiled page already has generated names.

The existing per-asset lexical wrapper is applied before Oxc optimization, so source-only helpers and private declarations can be removed or shortened safely. Applying it after minification had kept those declarations as observable globals. This is an adapter/minifier improvement and is included in every adapter control, not credited to CSS factoring.

Article shader templates use an explicit `glsl(template)` authoring marker. A separate website-owned AST pass removes line comments and horizontal boundary whitespace from static templates before Oxc runs, preserving every GLSL token, newline, and compiler line position. Dynamic or uncertain preprocessing remains unchanged. The original shader sources stay readable; independent token tests and native compilation of every scene validate the generated strings. These shader savings are reported separately from the CSS plugin.

Unknown references preserve their observed class names. Unmanaged concatenation, interpolation, joins, and unresolved construction calls in class-bearing DOM operations preserve the managed namespace instead of treating their pieces as complete names. Explicit compiled bindings may compose with whitespace or attribute-only fragments; copied DOM class values and getAttribute("class"/"href") already use compiled output. CSS selectors are parsed to account for Unicode identifiers, escaped identifiers, nested selectors, and class-attribute queries. Ambiguous class-attribute queries and incomplete escaped selectors conservatively preserve the managed namespace. Raw-text/RCDATA content and code examples are not markup bindings. Markdown uses the renderer's exact options, combines contiguous HTML events into complete rewriter inputs, and leaves fenced code and prose unchanged. Unsupported Markdown-generated heading classes retain their authored names.

The build writes `css-compact-input.json`, `css-compact-output.json`, `compact_bindings.rs`, and `compiled-articles/` under Cargo's `OUT_DIR`. The portable manifest contains the generation, identity names, expanded class lists, stylesheet hashes, and chunk boundaries. The JSON input/output provide reproducible adapter evidence; framework source extraction stays outside the standalone crate.

Use `ENG_CSS_MODE=baseline`, `naming`, or `compact` for comparison builds. Default production mode is `compact`. Freeze each resulting binary and its manifest before native comparisons; rebuilding while a debug server is running can change its embedded asset directory. See the evaluation report for measured route transfers and native equivalence checks.

The adapter's `baseline` mode is the guard-only control, separate from the frozen original release and stock Lightning CSS upgrade-only control. It retains compiler correctness guards while disabling class naming and declaration factoring. Preserve each mode's complete `css-compact-input.json` and `css-compact-output.json`; do not assign correctness-guard deltas to naming or factoring. The [website evaluation](css-compression-evaluation.md) reports the adjacent original → upgrade → guard → naming → compact rendered HTML/CSS/JS deltas and uses the original authored-class DOM as the native binding oracle.

Native journey and authored-graphics tooling accept the saved output of the exact adapter build:

```sh
node --max-old-space-size=8192 scripts/profile-journey.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --passes=2 --cpu=4 --output=/tmp/css-compact-journey --assert
node scripts/verify-article-heroes.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/css-compact-heroes
node scripts/verify-article-diagrams.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/css-compact-diagrams
```

For guard-only and naming-only controls, substitute their frozen URL and manifest. Original and stock upgrade-only releases omit `--css-manifest`. The tooling checks generation provenance and binds explicit owned names; it never ships a runtime style registry or rewrites arbitrary source. Keep the graphics fixtures separate from quiet journey timing, as described in [the profiling protocol](../scripts/JOURNEY_PERFORMANCE.md).

# Deployment consistency

Application HTML carries `eng-css-generation`, retains its original per-route browser cache policy, and explicitly prevents CDN storage. A cached document and its exact hashed assets are one coherent older release. CSS and JavaScript retain content-addressed immutable URLs. An unknown obsolete hash returns 404; it never aliases a new class map. A provenance-checked compatibility archive preserves the exact previous release's CSS and JavaScript at their original hashes, so HTML already cached before adoption can boot its matching assets. Full SHA-256 digests, lengths, MIME types, original commit, and frozen binary digest are verified. The build rejects a legacy/current short URL collision when their full digests differ. Soft navigation rejects mismatched generations before loading destination styles or changing the DOM. It permits one automatic whole-document recovery per destination/generation pair and preserves the current surface when offline or after a repeated failure.

An initial asset miss fails closed: an unknown content hash returns 404 instead of bytes from another class map. The authored content and ordinary links remain available for a manual reload. There is no additional healthy-page recovery runtime. The navigation router retains its bounded generation/asset-failure recovery after it loads. Native tests exercise missing CSS and router hashes, default links, blocked session storage, offline reading, and exact legacy assets.

The standalone unsubscribe form and native POST results also inject managed critical, newsletter, and sigil styles. Their wrapper carries the shared generation under its existing private CSP and `no-store, no-transform` policy. An ordinary clean `/unsubscribe` link remains available even when assets or JavaScript fail, preserving the current form or result until the reader chooses it. This document loads no recovery runtime, so recovery cannot read a bearer URL, persist a token, replay a script or turn a POST result into a GET. The standalone document audit covers PageShell, the personality wrapper, and this newsletter wrapper. The dependency-free server-error and offline documents contain only their own inline CSS and remain outside the generated class map.

The first adoption carries `website/compat/css-generation-2061afa3/`, containing the exact frozen prior release's class-dependent assets. The prior router compares complete asset URLs before applying a destination and hard-navigates across a changed version, so an old cached document remains coherent until it loads current HTML. Keep that bridge immutable and preserve the matching assets of later compact generations across their real browser freshness, stale-while-revalidate and offline-cache horizons. Remove a generation only after establishing that its document caches have expired or been migrated. Published assessment documents keep their separate immutable/private cache and CSP boundaries.
