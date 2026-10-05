# Cyclic navigation implementation

Source: complete 12:52 design transcript supplied on 2026-09-24.

## Experience and decisions

The reading surface reveals the storefront underneath it as the reader reaches
the end. The storefront then reveals coaching, coaching reveals the newsletter,
and the newsletter returns to the feed.
Opening an article from the feed is ordinary navigation. Minimal, labelled
triangle/shop and coaching icons also provide direct access.

Three bounded outlets represent current, next and previous. Near the end of a
page, an IntersectionObserver fetches the next server-rendered document and
prepares an inert preview. The foreground scrolls away while the preview stays
fixed, framed, theme-aware and scaled to roughly 0.8. A completed deliberate
scroll or the visible continue link promotes it, updates history without a
refresh, and settles into full size with a restrained spring and content reveal.

Only a reveal creates a compact previous-page tab. Its left arrow and title-cased
article slug (or surface name) resume the former scroll position with a reverse
transition. The tab can be dismissed with its close button or a horizontal swipe,
and temporarily hides behind product, bag and booking dialogs.
Each new reveal replaces the previous tab; there is no thumbnail or preview stack.
Normal browser Back/Forward continues to work independently. Direct navigation
does not manufacture a previous card or a coaching upsell window.

Browser history cannot rewrite the origin. Same-origin `/shop`, `/coach`,
`/subscribe` and `/feed` routes therefore power the continuous journey on every supported host.
Existing shop/coaching subdomain entry points and the legacy `/coaching` redirect
remain valid. Full document navigation is required when actually changing host.
Reference: https://developer.mozilla.org/en-US/docs/Web/API/History/pushState.

The private personality assessment and introduction, checkout, API routes,
downloads, external links and forms preserve their document boundaries.

## Repository context

Axum renders complete documents through the shared PageShell and embeds hashed
CSS/JS at build time. Blog scripts already register `__engNav.onSwap`; the old
router is dormant in Chromium and excludes shop/coaching. Shop and coaching own
their dialog URL state and need explicit mount/dispose lifecycles. Page configs
currently use inline assignment scripts; the router needs inert JSON instead of
executing fetched inline code. Themes live on `<html>`. Root and assessment
service workers have separate privacy/cache rules. CI runs Node release checks,
Rust format, clippy, unit/integration tests and real Chrome browser tests.

## Issue-by-issue plan

- [x] **1. Server routes and shell contract.** Add same-origin aliases and product
  deep-link fallback; preserve host behavior and direct-load HTML; ship router
  and journey stylesheet on eligible surfaces; add JSON config and before-swap
  lifecycle hooks; expose accessible shop/coaching icons. Test aliases, metadata,
  assets and the private assessment boundary.
- [x] **2. Page lifecycles.** Mount/unmount shop and coach on swaps; abort listeners,
  timers, observers and in-flight work; dispose Stripe/UI resources; retain cart
  persistence; preserve router history state during dialog URL changes; correct
  shop-home and coaching mode links when using aliases; signal overlay state.
- [x] **3. Shared routing.** Implement progressive same-origin click/history
  routing for feed/articles/search/shop/coach; synchronize metadata, safe config,
  body state and ordered hashed assets; reject deploy skew and redirects across
  boundaries; abort superseded loads; retain ordinary navigation as fallback.
- [x] **4. Next-page reveal.** Prepare one next document near the page end; render
  an inert visual preview without executing page scripts early; frame it beneath
  scrolling content; promote once after intentional end scrolling or activation;
  guard short pages, initial/restored scroll and overlays; apply reduced-motion,
  data-saving and failure fallbacks; stagger content after the transition.
- [x] **5. Previous-page resume.** Retain one ephemeral page snapshot and viewport;
  render a labelled, inert thumbnail with separate resume/dismiss controls;
  support swipe dismissal, responsive placement, reverse transitions, scroll and
  focus restoration; hide during dialogs and clear on ordinary navigation.
- [x] **6. Verification and refinement.** Test the whole cycle in real Chrome,
  direct links, aliases, overlays, browser history, repeated mounts, reduced
  motion, mobile dimensions, dismiss/resume, network failure and cancellation.
  Run the complete existing CI checks and visually inspect the experience.
- [x] **7. Pull request and CI.** Commit coherent changes, push the feature branch,
  create and attach a PR with implementation/validation evidence. Inspect check
  results; read failing logs, fix causes, push and repeat until required checks
  are green for the final commit.

## Acceptance and implementation constraints

- Next content is fetched once for the active candidate, with bounded previous /
  next state rather than an unbounded route cache. New navigation cancels stale
  work. Deployment asset mismatch falls back to a real load.
- Previews cannot submit forms, run scripts, start payments, steal focus or
  duplicate IDs into the active document. Only the active page hydrates.
- The URL, document title, canonical/social metadata and active content agree.
- Focus lands on the active heading; a polite announcement identifies a promoted
  page. Keyboard users have a real link/button; reduced motion skips scale and
  spring animations. No automatic promotion on first load or scroll restoration.
- Product/bag history stays under the shop controller while the shared router
  handles changes between page surfaces. A previous card survives closing a
  product overlay and is never interactive above a modal.
- The existing article content, checkout and frozen personality releases stay
  compatible. No changes to published immutable assessment assets.

## Progress and evidence

Implementation and final verification notes will be recorded here as each issue
is completed.

- Issue 1: `/feed`, `/shop`, `/coach`, and product deep links render on apex,
  shop, and coach hosts. Eligible documents carry a complete `data-eng-page`
  outlet, their optional next URL, an ordinary fallback link, ordered assets,
  and inert JSON configuration. Legacy subdomain roots, canonical metadata,
  checkout partitioning, and the private assessment boundary remain covered.
  `cargo test -p website --bin website` passed all 113 tests, including the new
  route/config checks, percent-encoded assessment boundary regression, and
  payment-return cache guards across all hosts and document/asset routes.
  Journey pages suppress speculative prerendering. Root service-worker v6
  bypasses private/payment URLs and respects response cache restrictions;
  its 14 bypass and 6 cache-policy cases passed a Node VM check.
- Issues 2–5: shop/coaching and article enhancements now mount/dispose through
  the shared lifecycle. Detached previous DOM preserves forms, reader position
  and pause intent. Next and previous visual previews are sandboxed, script-free
  iframe documents; only the promoted outlet hydrates. Scroll promotion requires
  recent downward user input, a completed reveal, no dialog, and a settled page.
  Reduced motion skips animation; Save-Data keeps the explicit continue link.
  The default animation uses the native Web Animations API and has no animation
  library dependency.
- Routing synchronizes title, canonical/social metadata and allowlisted JSON;
  deduplicates hashed assets, awaits pending styles, loads local bundles in order,
  and loads optional CDN dependencies in a separate ordered sequence. Superseded
  fetches abort, queued history traversals honor the latest entry, and settled
  anchor positions are written back to history. Deployment skew or failed active
  loads use ordinary navigation. Failed speculative loads keep content readable.
- The execution-marketplace diagrams moved from an inline module into a hashed
  lifecycle bundle so direct and soft entry both render them. Existing OKLCH
  theme colors are normalized for Mermaid. Published assessment assets are intact:
  all 159 Node tests and the v1–v6/AI byte inventory checks passed.
- Visual browser inspection confirmed the framed underlay, automatic article →
  shop promotion, the previous article thumbnail, and resume at the saved reading
  position. It identified and fixed intermediate-width nav compression and a
  payment CDN delaying interactivity.
- Final local verification: `REQUIRE_BROWSER_TESTS=1 cargo test -p website`
  passed all 121 tests (113 unit/router, 1 article CTA, 1 coaching browser,
  3 coaching HTTP, 2 journey browser variants, 1 personality browser). Both new
  motion variants cover the complete cycle, modal restoration, real pointer
  swipe, exact anchor/history positions, rapid Back/Forward during a transition,
  mobile/686px navigation, paused reader resume, cancellation and failed preload.
  An initial full run hit a Chrome transport reset; the harness now serializes
  Chrome lifetimes and captures process/stderr diagnostics without retrying or
  suppressing assertions. The complete rerun passed.
- `cargo fmt --all --check`, `cargo clippy -p website --all-targets -- -D warnings`,
  JavaScript syntax checks and `git diff --check` passed.
- The first PR run found a reduced-motion product-card scale transition. A real
  CDP Tab event made it reproducible locally: the global 0.01ms duration still
  created a running `none` → `scale(1.1)` transition. The storefront now disables
  card transitions and hover/focus scaling under reduced motion while preserving
  its keyboard focus outline. The browser regression checks actual visible
  keyboard focus, computed styles, and active animations, with target/keyframe
  diagnostics on failure.
- Issue 7: [PR #55](https://github.com/matthewharwood/engmanager.xyz/pull/55)
  contains the complete implementation. GitHub CI
  [run 36087551168](https://github.com/matthewharwood/engmanager.xyz/actions/runs/36087551168)
  passed every step for implementation commit `56c796e`: personality tests and
  immutable-release checks, formatting, clippy, and the complete Rust/browser
  suite. The reduced-motion fix also passed both local journey variants.

- 2026-10-05: the previous-page thumbnail is replaced by a single-row resume
  tab with a left arrow, title-cased article slug or surface name, close button,
  and native swipe dismissal. It retains the page and its scroll position without
  creating an iframe, cloning content, or scheduling thumbnail population.
  Navigation keeps its glass blur with a matching sine-wave edge; metadata,
  TOC and semantic horizontal rules share a 1px stroke and 16px crest-to-trough
  wave. CSS timelines move right during hover, preserve their phase when paused,
  and pause for hidden documents, journey transitions and reduced motion.
- Native pointer checks cover hover, pause/resume, the content above a rule,
  reduced motion, and overflow. Journey and typography browser fixtures verify
  retained resume, dismissal, history, overlays and decoded-font reuse with the
  text tab. All required CI gates pass: 381 Node tests, immutable releases,
  regenerated v7 inventory without changes, formatting, Clippy, and the complete
  `CHROME_BIN=... REQUIRE_BROWSER_TESTS=1 cargo test -p website` suite.
- Native comparison evidence is saved at `/tmp/engmanager-wave-review`:
  frozen release binaries and exact CSS manifests, SHA-256 fingerprints,
  original CLI reports, reanalyzed reports, uninterrupted cold/warm traces,
  per-phase CSVs, screenshots, and `comparison.json` with per-leg presentation,
  TouchScroll drops, GPU submissions, fades and encoded transfer bytes.
  Both builds used Chrome 154.0.8037.93 on an Apple M4 Max/Metal GPU,
  390×844 touch viewport, DPR 2, 4× CPU and shaped 4G (4/1 Mbps, 120ms).
  The service worker was bypassed for comparative network shaping; ordinary
  service-worker and font-cache recovery remain covered by browser tests.
  This is desktop emulation evidence, not physical Android certification.

| Article fixture | Build | Worst scroll presentation p95 | Worst fade compositor p95 | Worst TouchScroll drops |
| --- | --- | ---: | ---: | ---: |
| Latest | Baseline | 18.02 ms | 18.75 ms | 0.45% |
| Latest | Candidate | 18.70 ms | 18.84 ms | 0.44% |
| Execution marketplace | Baseline | 17.75 ms | 18.56 ms | 0.45% |
| Execution marketplace | Candidate | 18.40 ms | 19.17 ms | 0.44% |

Both candidate `--assert` runs pass all budgets across ten legs each. All four
captures have zero scroll/settled missing presentations, fade/settled main-thread
long tasks, and hard-navigation fallbacks. Raw reports retain readiness time and
opaque preparation separately from the actual visible poster fade.

- 2026-10-05 follow-up: `/` and `/feed` read-title strikeouts use the same
  sine-wave mask as the separators. The first-read sweep remains on the wrapper;
  its child independently drifts right on row hover and retains its exact paused
  phase. Touch, reduced motion, hidden documents and journey transitions keep
  the wave paused. Small inline strikeout styles use native wavy text decoration
  to preserve wrapping. Checkmarks and persisted reading state are unchanged.
- Native Chrome checks exercise both feed routes, an actual first-read click,
  hover/pause/resume, reduced motion, theme-font readiness, and 390px/320px
  overflow. All required CI gates pass again, including 381 Node tests and the
  complete required Chrome suite. Evidence is at
  `/tmp/engmanager-wavy-strike-review`, with screenshots, frozen binary/manifest
  hashes, original reports and uninterrupted cold/warm traces, analyzed reports,
  and per-leg GPU, presentation, fade, drop and encoded-byte comparisons.
- The pre-strike baseline reuses the preceding divider candidate's captures;
  its frozen binary and CSS manifest match byte-for-byte. Both comparisons use
  the same Chrome 154.0.8037.93, M4 Max/Metal GPU, 390×844/DPR 2 touch viewport,
  4× CPU, shaped 4G and trace analyzer described above.

| Article fixture | Build | Worst scroll presentation p95 | Worst fade compositor p95 | Worst TouchScroll drops |
| --- | --- | ---: | ---: | ---: |
| Latest | Pre-strike baseline | 18.70 ms | 18.84 ms | 0.44% |
| Latest | Wavy strike candidate | 18.52 ms | 19.10 ms | 0.45% |
| Execution marketplace | Pre-strike baseline | 18.40 ms | 19.17 ms | 0.44% |
| Execution marketplace | Wavy strike candidate | 18.51 ms | 18.65 ms | 0.44% |

Total captured encoded bytes across both laps are 16,405,648 → 16,405,670 for
latest and 16,423,483 → 16,423,005 for the long article. Per-leg attribution is
recorded separately: the same article model request can begin outside a marked
phase, so summing phase windows does not measure the complete capture.

Both new `--assert` captures pass all budgets across ten legs each, including
zero scroll/settled missing presentations, fade/settled main-thread long tasks,
and hard-navigation fallbacks. This remains a desktop emulation comparison;
physical Android certification requires a separate device capture.


- 2026-10-05 marble/button follow-up: the newsletter's inline armillary is now
  original Blender geometry with a faceted globe, four carved orbital bands,
  spindle and turned museum base. Its detailed source is preserved separately
  from the simplified GLB. It uses the shared journey renderer's ivory grain,
  cavity shading, shadows and MSAA; the five transition models are unchanged.
  A matching decoded WebP survives Save-Data, unavailable GPU, load failure and
  device loss. Native Chrome inspection covers all six actual GLBs at front,
  profile and three-quarter angles, static/reduced rendering and disposal;
  `scripts/journey-posters/sources/armillary-browser-review.json` fingerprints
  the exact models and records newsletter pause/resume, offscreen/curtain holds
  and retained fallback/control restoration.
- Continue buttons use a CSS border pulse on the visible poster and a clipped,
  repeating text marquee during mouse hover. The pulse decorates a fixed click
  target; a single accessible label remains available. Both timelines pause
  while hidden or committing, and reduced motion keeps the stationary label.
  Native pointer tests sample button bounds, hit testing and horizontal overflow
  throughout animation at desktop and 320px widths, in both motion variants.
- All required CI gates pass: 382 Node tests, immutable personality releases,
  unchanged regenerated v7 release inventory, formatting, Clippy, and the full
  required Chrome/Rust suite. The retired procedural mesh-reference fixture is
  replaced by actual GLB contract, rotation and renderer lifecycle checks.
- Evidence is preserved at `/tmp/engmanager-marble-subscribe-review`: Blender
  studies, native WebGPU screenshots/report, frozen release binaries and exact
  CSS manifests with SHA-256 hashes, original CLI reports, uninterrupted
  cold/warm traces, analyzed reports and per-leg encoded-byte/frame comparisons.
  The pre-marble baseline reuses the preceding wavy-strike candidate captures;
  its binary and manifest match byte-for-byte. Profiling and analysis sources
  are unchanged. Both use Chrome 154.0.8037.93, Apple M4 Max/Metal, 390×844 touch
  viewport, DPR 2, 4× CPU and shaped 4G (4/1 Mbps, 120ms), with the service worker
  bypassed for comparative request shaping.

| Article fixture | Build | Worst scroll presentation p95 | Worst fade compositor p95 | Worst TouchScroll drops |
| --- | --- | ---: | ---: | ---: |
| Latest | Pre-marble baseline | 18.52 ms | 19.10 ms | 0.45% |
| Latest | Marble/button candidate | 18.60 ms | 19.02 ms | 0.44% |
| Execution marketplace | Pre-marble baseline | 18.51 ms | 18.65 ms | 0.44% |
| Execution marketplace | Marble/button candidate | 17.73 ms | 18.09 ms | 0.44% |

Both candidate `--assert` captures pass every budget across ten legs each, with
zero scroll/settled missing presentations, fade/settled main-thread long tasks,
and hard-navigation fallbacks. Opaque preparation remains separately recorded
from the actual visible fade. Total captured encoded bytes across cold/warm laps
are 16,405,670 → 16,825,491 for latest and 16,423,005 → 16,842,266 for the long
article. Per-leg attribution is retained in `comparison.json` and the raw
reports; phase-window sums are not the complete capture. This is native desktop
rendering with mobile emulation, not physical Android certification.

- 2026-10-05 foreground-photo follow-up: the existing 48px bio trigger on `/`
  and `/feed` now reflects off both viewport edges at the DVD's 38/27px-per-second
  speeds. Its upright transform sits above navigation and article titles.
  Hover, visible keyboard focus, an open bio and dragging independently pause
  it. Hidden/offscreen/disposed pages, reduced motion, and journey exposure or
  commits stop its RAF work; scrolling back and retained navigation resume one
  controller at the existing position. An initial reduced-motion visit retains
  the stationary docked button. Dragging persists once per drop, while moving
  frames use cached dimensions and never write progress or read geometry.
- The anchored bio wraps long lines, stays within the viewport, and tries
  opposite edges or a bounded viewport placement. Native Chrome verifies the
  actual CDN photo, foreground hit testing, every-edge bio placement, click and
  Escape on both routes at 1200px, 390px and 320px widths, in both motion modes.
  Real dragging saves one bounded position; a native phone tap pauses for the
  open bio and resumes after dismissal. Unit checks cover independent holds,
  visibility/preferences, reflected bounds, retained/disposed observers and
  zero continuous layout/storage work. The real journey fixtures also cover
  keyboard focus, automatic poster reveal, Continue hit testing and retained
  restoration. Their restrictive proxy admits the public photo's CDN path;
  responsive catalog decoding retries only an observed srcset replacement,
  within the existing deadline, with the original transfer/size assertions.
- Evidence is at `/tmp/engmanager-foreground-avatar-review`, including native
  screenshots/report, actual gesture results, frozen binaries and exact CSS
  manifests, source hashes, CI logs and raw performance captures. The baseline
  reuses the preceding marble/button candidate captures; its frozen binary and
  manifest match byte-for-byte, with unchanged profiling and analysis sources.

All required CI gates pass again: 388 Node tests, published personality byte
verification, unchanged regenerated v7 inventory, formatting, Clippy and the
complete required Chrome/Rust suite. Powered native captures use the same
Chrome 154.0.8037.93 and Apple M4 Max/Metal, 390×844 touch viewport, DPR 2, 4× CPU
and shaped 4G (4/1 Mbps, 120ms), with the service worker bypassed for comparative
shaping. Both candidate `--assert` captures pass all budgets across ten legs
each. All four comparison reports have zero scroll/settled missing
presentations, fade/settled main-thread long tasks and hard-navigation fallbacks.
The original CLI reports and raw traces remain separate from analyzed reports.

| Article fixture | Build | Worst scroll presentation p95 | Worst fade compositor p95 | Worst TouchScroll drops |
| --- | --- | ---: | ---: | ---: |
| Latest | Pre-photo baseline | 18.60 ms | 19.02 ms | 0.44% |
| Latest | Foreground-photo candidate | 17.73 ms | 17.91 ms | 0.44% |
| Execution marketplace | Pre-photo baseline | 17.73 ms | 18.09 ms | 0.44% |
| Execution marketplace | Foreground-photo candidate | 18.22 ms | 18.28 ms | 0.44% |

Total captured encoded bytes across cold/warm laps are 16,825,491 → 16,828,077
for latest and 16,842,266 → 16,845,416 for the long article. Per-leg attribution
remains in `comparison.json`; phase-window sums do not measure the full capture.
This remains desktop native rendering with mobile emulation, not physical
Android certification.

The initial candidate capture dropped to 30Hz on later legs while the laptop
was below 20% battery. A new control using the unchanged frozen baseline also
ran at 30Hz, with zero missing pixels. Connecting AC restored 60Hz without
changing runtime code, geometry, profiler flags or budgets. Those failed latest,
long-article and baseline-control traces, their strict assertion results and
power-state records are preserved alongside the passing powered captures.
The profiling protocol now requires recording stable AC power on laptops.

- 2026-10-05 marble cursor follow-up: the link/drag hand on `/` and `/feed` is
  rebuilt in Blender as God's right-side hand from *The Creation of Adam*.
  The index reaches left, the thumb crosses below it, and three relaxed curled
  fingers preserve the painting's silhouette. The wrist is cut and capped.
  Front, profile and three-quarter studies compare the painting and credited
  public-domain anatomical photographs before material/export acceptance.
- `_docs/cursors/creation-hand.blend` retains a detailed 152,635-vertex source
  and an independent 12,975-vertex / 25,946-triangle browser copy. Both are one
  outward closed solid with zero non-manifold/boundary edges; nails and folds
  are carved relief. Original authored geometry, reference licenses, repeatable
  modeling commands and the exact exported fingerprint are in the cursor README
  and validation report. The 887,940-byte GLB is loaded only for fine mouse
  intent; reduced motion, touch, Save-Data and unavailable GPU use native cursors.
- The cursor renders high-key white marble with baked cavities, subtle veins,
  soft lighting and 4× MSAA. Its left index tip stays at the exact `(36,54)`
  canvas hotspot through movement, click and Grip. One bounded same-origin
  decoder worker validates the actual core GLB, transfers typed arrays, cancels
  with ownership, times out at 8 seconds and shuts down after 10 seconds idle.
  Unavailable workers use the same strict validation cooperatively. Rendering
  stops at rest, offscreen/hidden, during journey exposure and on disposal.
- Native Chrome 154.0.8037.93 on Apple Metal verifies the actual exported GLB
  and WGSL with back-face culling in front, true profile, three-quarter and Grip
  views on dark/light surfaces. Both routes retain exact fingertip coordinates,
  real photo clicks/Escape, topic-chip drag/Grip, idle suspension, disposed GPU
  ownership and single-overlay retained restoration. Native reduced-motion,
  Save-Data, GPU and worker fallbacks pass without CSP violations. A separate
  native wheel case enters the automatic reveal, verifies Continue hit testing
  and zero cursor submissions, and restores the cursor on scroll-back.
- All required CI gates pass: 392 Node tests, immutable personality release
  verification, unchanged regenerated v7 inventory, formatting, Clippy and the
  complete required Chrome/Rust suite. Evidence is preserved in
  `/tmp/engmanager-marble-hand-review`, including Blender studies, native GPU
  screenshots/reports, CI logs, source/export hashes, frozen release binaries
  and exact CSS manifests. The baseline reuses the preceding foreground-photo
  candidate's powered raw latest/long captures; binary and manifest match
  byte-for-byte. The new candidate's AC-powered cold/warm journey capture is
  pending the laptop power setup required by `scripts/JOURNEY_PERFORMANCE.md`;
  its timing budgets are not claimed as verified yet.

- 2026-10-05 wave-density adjustment: the shared sine period is reduced from
  96px to 24px (a 48px tile contains two periods). Navigation glass and stroke,
  metadata/TOC separators, horizontal rules and homepage/feed strike-throughs
  use the same tighter geometry. The 16px crest-to-trough height, 1px stroke,
  8-second timeline and retained hover phase remain unchanged. Native Chrome
  checks the actual SVG bounds and masks, hover/pause/resume, reduced motion,
  and desktop/mobile screenshots. Evidence and the frozen release/manifest are
  in `/tmp/engmanager-tight-wave-review`; the local review is served on port 3095.
  The release build, formatting and both required normal/reduced-motion Chrome
  journey fixtures pass for this adjustment. The AC-powered timing comparison
  remains pending the power setup recorded for the preceding cursor review.

- The first Linux CI runs of these wave checks exposed a desktop-fixture
  configuration gap: headless Chrome reported `(hover: none)` and
  `(pointer: none)` while native mouse input correctly hovered the navigation.
  The desktop Chrome harness now sets Blink's fine-pointer and hover
  capabilities explicitly, and the journey fixture asserts both capabilities
  before exercising the unchanged normal/reduced-motion wave assertions.
  A native control against the frozen final release reproduces the failure
  with no-device capabilities, animates with desktop capabilities, and stays
  paused with reduced motion; all three retain their phase on pointer leave.
  Logs and controls are preserved in `/tmp/engmanager-morning-pr-review`.
