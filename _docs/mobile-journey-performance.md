# Mobile journey performance

The feed → article → shop → coach → subscribe → feed cycle passes the native Chrome profiler's strengthened budgets across twenty cold/warm transitions. Cold shop promotion falls from a 15.381 s timeout/hard-navigation fallback to 1.447 s in the same document; moving sculpture submissions now follow display cadence. This is desktop comparative evidence, not physical Android certification.

## Protocol and provenance

Frozen baseline release `e18db9c525b0a9b09c0ba63295d7529bacd8210d` runs on port 3091; the candidate release runs on 3092. Both embed their assets and use the same quiet M4 Max, 16 CPU cores, 48 GB RAM, Chrome `154.0.8037.93`, native ANGLE Metal, 390×844 touch viewport, DPR 2, 4× CPU, 4 Mbps down / 1 Mbps up, and 120 ms latency. Cold clears HTTP cache; warm reuses it in a new document.

Uninterrupted traces begin before navigation. Actual presentations/TouchScroll, exact visible fades, and sculpture submissions are measured separately. PipelineReporter attributes deduplicated pixel warnings. Matching counter-v2 analysis retains raw provenance and narrowly corrects Chromium's merged termination counters. Analyzer/parser SHA prefixes are `3a7b92cf`/`ba5874e6`; final capture harness is `8dfa5fde`.

Comparative runs bypass service-worker registration/interception because page-target shaping excludes its separate requests. Installation precaches only `offline.html`; ordinary behavior is verified separately.

Raw traces, reports, phase CSVs, screenshots, GPU metadata, and full fingerprints are preserved:

- Baseline: `/tmp/engmanager-perf-baseline-final-protocol/`
- Latest: `/tmp/engmanager-perf-final-diagrams-latest-4x/`
- Long: `/tmp/engmanager-perf-final-diagrams-long-4x/`

Both candidates serve `nav-router.460f94c6.js`, `journey-poster-renderer.1f9982b9.js`, `article-heroes.1ae896ce.js`/`article-heroes.96df19ea.css`, `article-diagrams.908ed742.js`, `c-armillary.53c0e3d2.js`, `shop.a0b0ddd4.js`, and `journey.6642a24a.css`.

## Results

Both candidate reports pass `--assert`, budget version `scroll-fade-settled-longtasks-v2`. Baseline/latest select the Gmail article; long selects `the-execution-marketplace`. Cells are cold/warm milliseconds.

| Promotion | Baseline | Latest | Long |
| --- | ---: | ---: | ---: |
| Feed → article | 995/978 | 939/917 | 973/905 |
| Article → shop | 15,381/927 | 1,447/822 | 1,444/808 |
| Shop → coach | 916/903 | 906/870 | 908/886 |
| Coach → subscribe | 1,223/960 | 1,214/910 | 1,195/894 |
| Subscribe → feed | 991/1,005 | 950/979 | 1,009/993 |

Aggregate traced Layout time during continuous gestures, not single-frame cost:

| Scrolling route | Baseline | Latest | Long |
| --- | ---: | ---: | ---: |
| Feed | 37.0/32.2 | 30.9/26.5 | 26.9/28.5 |
| Article | 20.4/15.1 | 15.9/20.1 | 15.4/13.3 |
| Shop | 17.6/10.0 | 13.7/10.9 | 11.8/10.7 |
| Coach | 17.3/10.9 | 14.6/9.5 | 10.5/10.8 |
| Subscribe | 19.2/17.0 | 17.6/13.6 | 16.2/8.7 |
| Lap total | 111.5/85.2 | 92.7/80.5 | 80.7/71.9 |

Baseline scrolling and fades were already near 60 Hz. Changed-pose submission median improves from 33.2–33.5 to 16.5–16.9 ms; candidate p95 is 18.3–19.2 ms, maximum 33.8 ms. Scroll presentation p95 is 17.94–18.68 ms, p99 ≤24.06 ms, maximum 38.37 ms. TouchScroll drops/expected are latest 3/1135 cold, 3/1136 warm; long 3/1137 and 3/1133. Intentional stationary intervals producing zero frames are excluded from moving-pose cadence.

Visible-fade p95 is 18.01–18.99 ms. Coach fades retain 2/40 drops (5%) in latest warm and both long laps; long warm subscribe has 1/39, others zero. Every measured scroll/fade/settled phase has zero long tasks or missing pixels, with no overflow, fallback, page errors, or Stripe/Mermaid requests; native worker proof covers all twenty legs. One 54 ms cold latest feed-preparation task ends 129 ms before fading, under the fully opaque poster. Baseline arrival had two cold/one warm incomplete displays; candidates have none.

The timeout baseline recorded 6,619,810 encoded front bytes/22 requests. Each candidate's initial cold front set records 288,908 bytes/18 requests. Across each cold/warm pair, encoded front transfers total 294,738 bytes across 74 requests, including repeats/cache. Separately, eighteen original image bodies total 10,876,892 bytes versus 268,226 for 384 px derivatives. Body and encoded totals differ. Responsive 160/384/640 candidates retain 900 px originals for detail.

## Changes and validation

Scroll uses ResizeObserver geometry caches, batched reads, local transform/opacity, static clipping/shadows, bounded title caches, and one completion write. Destination bundles preload without execution. Idle previous-page snapshots cancel on navigation, load fonts/styles before insertion, pause SVG timelines, remove compositor hints, and scale before insertion while retaining viewport/scroll.

Strict GLB decoding uses a bounded cancellable worker and validated cooperative fallback. Settled/hidden/offscreen/reduced/disposed/covered decoration stops scheduling. GLBs, marble shading, shadows, geometry, antialiasing, and the 800 px/DPR 1.5 cap remain intact. Primary SVGs accompany asynchronous scene-specific WebGL compilation and once-per-frame shader invariants. Byte-identical armillary packing reduces focused native construction 64.2→8.5 ms cold/5.7 HTTP-warm; retained-document cache revisits take 0–0.4 ms.

Mermaid enhances one visible figure per idle turn, suspends during input/navigation, rechecks import/font readiness, cleans disposed scratch nodes, and uses unclipped SVG labels. The earlier long cohort passed narrower gates despite 93/58 ms settled tasks; the new gate covers them. Visible first-time graph layout is not benchmarked at 60 Hz.

Native inspection covers all five sculptures and twelve heroes: 24 normal/reduced cases plus twelve context-loss/SVG/restore checks, zero GL/overflow/disposal errors, authored framing and caption bounds. Browser fixtures also require visible SVG graphics and a hidden unused canvas when software WebGL lacks asynchronous compilation. Real-CDN diagram QA verifies all three complete labels/glyph bounds, themes, compact/expand/zoom, retained mounts, and cancelled imports. Ordinary-worker smoke passes ten promotions, five cache-storage model revisits, responsive images, original snapshot geometry, and 44 paused SVG timelines. These functional checks make no timing claim.

Evidence: `/tmp/engmanager-heroes-final-caption-authored/`, `/tmp/engmanager-ci-hero-swiftshader-fallback/`, `/tmp/engmanager-diagram-native-svg-complete/`, `/tmp/engmanager-diagram-native-svg-stable-first-ready/`, `/tmp/engmanager-ordinary-service-worker-smoke/`.

Mandatory local gates pass: 355 JavaScript and 183 Rust/browser tests, personality verification/regeneration, fmt, Clippy; normal/reduced, Save-Data/unavailable-GPU, restoration, interruption, readiness, disposal remain covered. Payment tests prove local-stub lifecycle/returns/retries, not actual provider/CSP admission.

## Reproduce and limits

Use [`scripts/JOURNEY_PERFORMANCE.md`](../scripts/JOURNEY_PERFORMANCE.md) for frozen releases and exact budgets:

```sh
node --max-old-space-size=8192 scripts/profile-journey.mjs --url=http://127.0.0.1:3092 --cpu=4 --passes=2 --assert --output=/tmp/journey-candidate
node --max-old-space-size=8192 scripts/profile-journey.mjs --url=http://127.0.0.1:3092 --cpu=4 --passes=2 --article=the-execution-marketplace --assert --output=/tmp/journey-candidate-long
node scripts/verify-article-heroes.mjs --url=http://127.0.0.1:3092 --output=/tmp/article-heroes-candidate
node scripts/verify-article-diagrams.mjs --url=http://127.0.0.1:3092 --output=/tmp/article-diagrams-candidate
```

No physical Android was connected. Device certification requires remote phone tracing and system-wide shaping; desktop emulation omits phone GPU/thermal/radio behavior. Lasting regression requirements are in `AGENTS.md`.
