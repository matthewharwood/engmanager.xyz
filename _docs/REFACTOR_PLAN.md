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
  main.rs            — composition root ONLY: load env, init tracing,
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
  experiences.rs     — Web-API-experiences manifest embed + JS↔manifest
                       parity test (companion to js/src/experiences.js)
  stripe/            — client.rs (shared timeout'd reqwest), checkout.rs, sync.rs
  sitemap.rs
  pages/
    shell.rs         — PageShell builder: invariant head block, MetaTags
                       (description/canonical/OG/robots/JSON-LD), theme_color,
                       page assets, component-head aggregation w/ dedup,
                       speculation-rules island, body scaffold
    {homepage,articles,search,shop,checkout,comments,not_found}.rs
  components/        — co-located <feature>/{mod.rs,style.css,script.js};
                       Rendered HOC + Head collector (dedup, tier-ordered,
                       blocking_js + inline_head support), Rendered::absorb
```

As-built corrections to the sketch (post-P7 audit): `pages/articles.rs` is a
single file, not an `articles/` directory; `experiences.rs` exists at the
crate root (added above); the planned `theme_picker` / `hunt_chip` components
were folded INTO `components/quick_actions/` (one region, one sheet, one
script) rather than shipped standalone; and quick_actions CSS landed in the
CRITICAL tier (the theme-picker + hunt-chip are visible at first paint), not
the deferred tier the P4 phase line predicted — api_receipt and
discovery_toasts are the deferred-tier overlays.

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
   `article:published_time` (the og `article:` namespace, detail pages only),
   twitter:*, JSON-LD, speculation-rules script; checkout gains the
   previously-missing `<link rel=manifest>`. Meta descriptions derive from
   the first PROSE paragraph — image alt text is excluded (post-P7 fix; no
   current article's description changed, the rule is pinned by test).
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

## Ledger additions (P4)

8. P4: overlay/toc/discord/region CSS moves from critical.css / articles.css /
   region-map.css into co-located c-<feature>.css files (@layer-wrapped, rules
   verbatim): critical.css + articles.css hashed URLs change; heads gain
   c-api-receipt / c-quick-actions / c-article-toc / c-discord-widget /
   c-region-map links per tier rules; selector sets per page unchanged
   (none lost, none duplicated).
9. P4: c-nav.css gains an opacity/transform fallback on .is-open so the
   dropdown is usable when the anime.js CDN fails (deliberate bug fix);
   nav script un-caches a rejected CDN import (retry on next open).
10. P4: build.rs — generated component-asset consts, style.css/script.js
    filename contract enforced (other css/js under a component dir panics),
    named-file diagnostics, parallel minify passes. No asset-output changes.

## Ledger additions (P5)

11. P5: comment POST error mapping — validation failures stay 400 (with
    message); storage failures become 500 with a GENERIC body (raw anyhow
    text no longer leaks to clients). Server-side semantics; no golden diff.
12. P5: comment-store connect failure at startup no longer aborts boot —
    comments API returns 503 (disabled mode), search index builds with empty
    comments, articles keep serving. Deliberate resilience change.
13. P5: PaymentIntent idempotency key now includes normalized shipping
    fields (fixes Stripe idempotency_error -> 502 on declined-card +
    edited-address retries). Stripe-API-facing only.

## Notes from P4 gates (carry to P7)

- speculation island pattern is /search* (broader than the plan's /search?*),
  deliberate.
- auteurs-shader.js loads on ALL article details (pre-existing; the name is
  misleading) — candidate for per-slug scoping LATER, not in this refactor.
- experiences.js:1514 logs provenance label "toc-waypoints.js" (now
  c-article-toc.js) — cosmetic; fix rides P6's experiences.js edits.

## Ledger additions (P6)

14. P6: body-level page islands gain data-swap-region attributes (additive,
    no visual impact); speculation island gains data-server marker.
15. P6: inline window.__engNav bootstrap script in shell head (all pages).
16. P6: js/nav-router.js script tag on router-eligible pages (homepage,
    articles index/detail, search). Router DORMANT on browsers that support
    Speculation Rules (Chromium keeps prerender + cross-doc VT, unchanged);
    activates only where Navigation API + same-doc VT exist without
    speculation support (Firefox 147+, Safari 26.2+). Debug force-flag for
    testing documented in the file.
17. P6: experiences.js — document.prerendering guards (no RUM/SW-register/
    beacons/comment-fetch/OSM-tiles from prerendered pages), speculation
    injection defers to the server island, provenance label fix; hashed URL
    changes.
18. P6: converted bundles (see _docs/JS_ROUTER_CONSTRAINTS.md section 2)
    change hashed URLs; load-time behavior WITHOUT the router byte-or-
    behavior-identical — conversions are refactor-to-init-fn + immediate
    call + onSwap registration only. Beyond the §2 list, the region-swap
    surface forced conversions of `nav-search-toggle.js` and `c-to-top.js`
    (their nodes live in swapped `data-swap-region`s, so the §2.110 "no
    conversion if shell-pinned" carve-out did not apply — both gained the
    lazy-resolve/data-bound re-init pattern), and `article-section-reveal.js`
    additionally gained the §3 prerender gate alongside its router-skip
    behavior.

## Ledger additions (P7)

19. P7: js/src/sw.js CACHE const "engmanager-v3" -> "engmanager-v4" — deploy
    coordination: old SW caches hold pre-refactor HTML referencing renamed/
    re-hashed assets; the bump purges them on activate. sw.js hash changes.
20. P7: CSP report-only header drops upgrade-insecure-requests (ignored in
    report-only mode per spec — dead directive; Chromium console-warns).
    Security headers otherwise byte-identical.
21. P5 (recorded post-P7): the search Clear-link's `query_encode` moved to
    `form_urlencoded::byte_serialize`, which encodes `~` as `%7E` and leaves
    `*` literal where the old hand-rolled encoder differed — byte changes in
    the emitted href ONLY for queries containing those characters,
    decode-identical through the parser (round-trip pinned by
    `clear_link_encoding_is_stable_and_round_trips`).
22. Post-P7 fix wave (this branch tip): hashed URL churn for
    `js/nav-router.js` (stale-swap abort re-checks + reduced-motion no-VT
    swap path), `js/copy-code.js` (Prism re-highlight on soft-nav swaps,
    flag-guarded so load behavior is unchanged), `js/experiences.js`
    (receipt-modal toggle/URL-sync re-bind after region swaps + post-swap
    `?receipt` popover sync). The region-map JSON config island now routes
    through `escape_script_payload` (byte-neutral for current data,
    test-pinned); meta-description derivation now skips image alt text (no
    current article changed — see #3). Server-side only (no golden-byte
    diff): layer reorder putting security/html-cache headers OUTSIDE the
    30s timeout (synthesized 408s gain security headers), debug-build
    asset_url memo bypass, CDN-directive u64 validation, Head cross-tier
    debug assert, stripe-sync SYNC_VERSION v2, env-before-tracing init
    order.

## Future work (explicitly deferred)

Accepted-but-not-now items from the P7 adversarial review. None block the
refactor; each needs either persistence, infra access, or a premise that
does not hold yet.

- **Stripe webhook event-id dedup** — the handler verifies HMAC + tolerance
  but does not dedup replayed `evt_*` ids; doing it right needs persistence
  (a seen-ids table with TTL). Revisit when the webhook actually mutates
  state (today it only logs/acks).
- **CommentsHandle live reconnect** — a store that is down AT BOOT stays
  disabled until restart (ledger #12 chose degrade-don't-abort). A
  background re-connect loop flipping disabled→connected is the upgrade.
- **Cloudflare dashboard tasks** (not expressible in code): verify the HTML
  Cache Rule actually honors `Cloudflare-CDN-Cache-Control` + `Cache-Tag`
  purge; evaluate Smart Tiered Cache; decide Speed Brain vs the
  server-emitted speculation-rules island (don't ship both blindly).
- **shop.js prerender storage-staleness guards** — premise check (P7 fix
  wave): on the MAIN site no island-bearing page links same-origin to
  `/products/*` — every shop CTA (article shop-breakout, search product
  results) is an absolute `https://shop.engmanager.xyz/...` URL,
  cross-origin from `engmanager.xyz`, so the speculation island
  (`href_matches:"/*"`, same-origin by construction) can never prerender a
  shop surface there. EDGE CASE that keeps this item alive: `/search` is
  not host-partitioned — served ON the shop host, its product links ARE
  same-origin `/products/*` and the island excludes only
  `/checkout*`/`/api/*`/`/search*`, so a shopper using
  `shop.engmanager.xyz/search` could prerender a product page whose
  shop.js would snapshot localStorage cart state pre-activation. If that
  path ever matters: add `prerenderingchange` re-hydration to shop.js (cart
  count, bag state) or exclude `/products/*` from the island on shop-host
  responses.
- **CSP enforcement** — the report-only policy (minus the dead
  upgrade-insecure-requests directive, ledger #20) has been clean; consider
  promoting to an enforced `Content-Security-Policy` after a burn-in period
  with report collection.
