# Deep Refactor Plan — big-refactor phase 2+

Source of truth for the multi-phase refactor. Baseline: commit `6c7cf10`
(checkpoint), `cargo check` clean, **19/19 tests green**, golden snapshots in
`/tmp/golden-pre/`. Prime directive: **no functionality or performance
degradation**. Every phase ends with: `cargo fmt --check`, `cargo clippy -p
website --all-targets` (no new warnings), `cargo test -p website` (all green),
golden-diff vs `/tmp/golden-pre/` showing only ledger-approved changes.

## Architecture target

```
website/src/
  main.rs            — composition root ONLY: init tracing, load config,
                       build state, build router, serve with graceful shutdown
  config.rs          — Config::from_env, dotenvy loading, SITE_ORIGIN/SHOP_ORIGIN,
                       shop-host matching (is_shop_host + SHOP_DEV_HOSTS)
  assets.rs          — Assets/CssDist/JsDist embeds, lookup_asset, memoized
                       asset_url, strip_asset_hash, asset/sw/favicon handlers
                       (zero-copy Bytes::from_static), ASSET_HASH_LEN const-assert
  http.rs            — security_headers_layer, html_cache_layer (success-only +
                       Cloudflare-CDN-Cache-Control + Cache-Tag), shared
                       response helpers (no_store, json_error)
  state.rs           — AppState + FromRef sub-states
  router.rs          — route-path consts + build_router(state); host dispatch
                       preserved behavior-identical; router-surface tests
  content.rs         — Article/Category/Tag/ArticleDate (validated const ctor,
                       Ord), ARTICLE_LIST, relations, ArticleSources embed,
                       article_markdown, startup-memoized rendered HTML+headings
  catalog.rs         — ShopProduct, SHOP_PRODUCTS, CAP_VIEWS, PriceCents newtype
  search.rs          — tantivy (typed, non-blocking commits via spawn_blocking)
  comments.rs        — SurrealDB store, typed CommentError (thiserror),
                       CommentStatus enum
  discord.rs         — poll loop; snapshot via AppState watch channel
  stripe/            — client.rs (shared timeout'd reqwest), checkout.rs, sync.rs
  sitemap.rs
  pages/
    shell.rs         — PageShell builder: invariant head block, MetaTags
                       (description/canonical/OG/robots/JSON-LD), theme_color,
                       page assets, component-head aggregation w/ dedup,
                       speculation-rules island, body scaffold
    {homepage,articles/,search,shop,checkout,comments,not_found}.rs
  components/        — co-located <feature>/{mod.rs,style.css,script.js};
                       Rendered HOC + Head collector (dedup, tier-ordered,
                       blocking_js + inline_head support), Rendered::absorb
```

## Phases (sequential; parallel agents only WITHIN a phase, disjoint files)

- **P0 done** — checkpoint commit, toolchain components (clippy/rustfmt),
  [profile.release] thin-LTO/cgu=1/strip, dev build-override, golden snapshots.
- **P1 core** — decompose main.rs into config/assets/http/state/router; keep
  `pub use` re-exports in main.rs so pages compile untouched; graceful
  shutdown (SIGTERM+ctrl_c); tracing + TraceLayer + 30s TimeoutLayer; fix
  html_cache_layer to stamp success-only (non-success HTML → `no-store`); ADD
  `Cloudflare-CDN-Cache-Control: max-age=3600, stale-while-revalidate=86400,
  stale-if-error=259200` + `Cache-Tag` alongside the UNCHANGED Cache-Control;
  zero-copy asset serving; memoized asset_url; router-surface oneshot tests.
- **P2 domain** — content.rs + catalog.rs extraction (fix pages→services
  inversion); PriceCents; validated ArticleDate; startup memoization of
  article HTML+headings (release-only; debug keeps disk-read live editing);
  fix `{#id}` headings dropped from TOC; missing .md → 404 not empty 200 +
  startup parity check; clippy default-warning cleanup (9).
- **P3 shell** — Head collector + absorb + blocking_js/inline_head tiers in
  components/mod.rs; PageShell; migrate all six pages; SEO heads (homepage +
  article detail + index: description/canonical/OG/twitter/JSON-LD);
  script_island helper (escapes `<`, U+2028/9) for ALL JSON islands;
  speculation-rules island (exclude /checkout*, /api/*, /search?*);
  fix checkout missing manifest link; articles index drops detail-only assets.
- **P4 components** — overlay cluster (api_receipt dedup, quick_actions,
  theme_picker, hunt_chip — @layer fp.overlay, deferred tier);
  discord_widget; article_toc + region_map (retire ArticlePageAssets);
  global_search component absorbed by nav; build.rs: generated
  component-asset consts ($OUT_DIR/component_assets.rs), style.css/script.js
  filename contract enforcement, named-file error diagnostics, parallel
  minify passes; nav script fixes (CSS no-anime fallback, un-cache rejected
  CDN import).
- **P5 services** — stripe split + shared 15s-timeout client + idempotency
  key includes shipping; CommentError mapping (validation→400, storage→500
  generic); comment-store startup degradation (Option/disabled → 503);
  spawn_blocking tantivy commit; poisoned-lock recovery; delete dead
  title_prefix field; form_urlencoded for search query parsing; page param
  overflow fix; tracing everywhere (kill eprintln); response helpers adopted.
- **P6 nav router** — JS-bundle audit (which features bind once vs delegate);
  js/src/nav-router.js: Navigation-API-gated fetch-and-swap, same-doc
  startViewTransition, same-URL full-page fetch + DOMParser, head asset diff
  by hashed name, anime spring on transition.ready, never intercept
  checkout/forms/cross-origin/modified clicks, failure → real navigation;
  per-feature re-init via window.__engNav.onSwap registry; only verified-safe
  bundles converted; @view-transition stays as fallback.
- **P7 verify** — adversarial multi-agent diff review; full gates; golden
  re-snapshot diff vs ledger; release build; perf sanity.

## Deliberate-change ledger (golden-diff allowlist)

Anything not listed here that differs from `/tmp/golden-pre/` is a BUG.

1. NEW response headers on success HTML: `Cloudflare-CDN-Cache-Control`,
   `Cache-Tag`. `Cache-Control` itself byte-unchanged.
2. 404/5xx HTML: `Cache-Control: no-store` (was: publicly cacheable — bug).
3. NEW head content (additive only): meta description, canonical, og:*,
   twitter:*, JSON-LD, speculation-rules script; checkout gains the
   previously-missing `<link rel=manifest>`.
4. Duplicate api-receipt-modal markup deduped (single component output —
   byte-identical markup, now from one source).
5. Articles INDEX page no longer loads detail-only assets (comments.css,
   Prism CDN, comments/copy-code/toc-waypoints/auteurs-shader JS).
6. P6: new `js/nav-router.js` script tag in shell-rendered heads.
7. Server log lines change format (tracing replaces eprintln) — not client-visible.

## Hard invariants (violating ANY fails the phase)

Full catalog lives in the workflow results; the absolutes:
- Route table, methods, and status codes unchanged (except ledger #2).
- Hashed asset URL shape `/assets/{stem}.{8hex}.{ext}`; strip_asset_hash
  accepts hashed AND flat; lookup precedence css/→CssDist, js/→JsDist, else
  Assets; build.rs naming (flat basenames, `c-<feature>` with `_`→`-`),
  collision panic, dist wipe, deterministic output.
- sw.js stays flat-named, served at /sw.js, no-cache + Service-Worker-Allowed.
- theme-toggle.js stays SYNCHRONOUS (no defer) in every head; sfx-urls island
  precedes audio.js consumers; popover-registry.js precedes c-nav.js.
- Stripe webhook gets RAW body (no request-body middleware), HMAC verify
  semantics, 200-when-unconfigured; create_intent server-side pricing +
  clamps; idempotency change is P5's ONLY semantic edit there (add shipping
  to the hash input).
- All data-* hooks, popover ids, window.__* island shapes (JS contracts).
- Shop/checkout/search/comments Cache-Control strings unchanged (shop page
  additionally gains the two new headers per ledger #1).
- Component render() purity; Rendered::head() tier emission shapes;
  @layer fp.overlay wrapping for overlay component CSS; critical.css first.
- dev feature: listenfd only under `dev`; render_dev_meta marker; debug
  builds keep per-request disk reads for live editing.
- Test-pinned: sitemap XML shape, shop head/catalog tests, reveal-section
  wrapper shape, nav markup byte-parity, experiences manifest parity.

## Known hazards

- Pinned nightly ICEs on heavy view!/html! edits (11 dumps at repo root from
  this branch). If rustc ICEs: retry once; if persistent, restructure the
  edit (smaller macro blocks) rather than fighting it.
- SW cache "engmanager-v3": old cached HTML references old asset URLs after
  deploy; bump the constant in the deploy that ships this refactor.
- experiences.js owns SW registration + receipt modal + toasts (page-level,
  ~2700 lines) — do NOT migrate it into a component this pass.
- manifest.webmanifest hardcodes the "Latest Article" shortcut and the
  engman**an**ager.xyz.png filename typo — both load-bearing; leave them.
