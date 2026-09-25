# Cyclic navigation implementation

Source: complete 12:52 design transcript supplied on 2026-09-24.

## Experience and decisions

The reading surface reveals the storefront underneath it as the reader reaches
the end. The storefront then reveals coaching, and coaching reveals the feed.
Opening an article from the feed is ordinary navigation. Minimal, labelled
triangle/shop and coaching icons also provide direct access.

Three bounded outlets represent current, next and previous. Near the end of a
page, an IntersectionObserver fetches the next server-rendered document and
prepares an inert preview. The foreground scrolls away while the preview stays
fixed, framed, theme-aware and scaled to roughly 0.8. A completed deliberate
scroll or the visible continue link promotes it, updates history without a
refresh, and settles into full size with a restrained spring and content reveal.

Only a reveal creates a previous-page card. It shows the former viewport and
resumes its scroll position with a reverse transition. The card can be dismissed
with its close button or a horizontal swipe, is landscape on desktop and taller
on narrow screens, and temporarily hides behind product, bag and booking dialogs.
Each new reveal replaces the previous card; there is no nested preview stack.
Normal browser Back/Forward continues to work independently. Direct navigation
does not manufacture a previous card or a coaching upsell window.

Browser history cannot rewrite the origin. Same-origin `/shop`, `/coach` and
`/feed` routes therefore power the continuous journey on every supported host.
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
- [ ] **7. Pull request and CI.** Commit coherent changes, push the feature branch,
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
  JavaScript syntax checks and `git diff --check` passed. PR checks are the final
  remaining issue; they must pass on the pushed commit before this goal is done.
