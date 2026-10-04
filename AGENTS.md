# Validation before pushing a PR

Use `.github/workflows/ci.yml` as the source of truth for required checks. A passing build or a few targeted tests does not prove the PR passes CI. Run these gates from the repository root with the pinned `rust-toolchain.toml` toolchain:

```sh
npm ci --prefix scripts --ignore-scripts
npm test --prefix scripts
node scripts/personality-release.mjs --verify-published
node scripts/personality-release.mjs
git diff --exit-code -- website/assets/personality/v7/release.mjs
cargo fmt --all --check
cargo clippy -p website --all-targets -- -D warnings
REQUIRE_BROWSER_TESTS=1 cargo test -p website
```

The website is a binary target; `cargo test -p website --lib` is not valid. Configure `CHROME_BIN` if Chrome is not automatically found. Keep `REQUIRE_BROWSER_TESTS=1` when verifying the full suite so browser checks cannot silently skip.

Fix Clippy warnings in the implementation instead of suppressing them just to pass CI. Run the same failing command locally after a fix, then complete the remaining gates that CI could not reach.

For browser-harness races, distinguish a missing execution context during navigation from a failed application assertion. Retry only the specific transient read within the existing deadline; do not mask arbitrary CDP errors, rerun whole failing fixtures blindly, or relax their assertions.

After pushing, inspect the PR checks and review feedback for the current head commit. When asked to make a PR pass, continue until all required checks have completed successfully on that commit; pending checks or results from an older commit are not proof. Diagnose failures from the job logs before changing code or rerunning a job.

For journey/navigation changes, keep the real Chrome tests for normal and reduced motion. Readiness must include returned mount promises, fonts, and visible-image decoding; a fixed delay is not proof that a page has rendered. Keep optional payment providers outside that gate.

Retained pages remount with their existing DOM. Reset GPU/audio control state before initialization, and cover resuming a previously animated page with Save-Data or unavailable GPU. Decorative scroll physics must settle without further input and stop scheduling frames while offscreen, hidden, reduced-motion, or disposed.

When adding forms to a new surface, verify its enforced Content-Security-Policy permits submission; markup alone cannot prove that a form works. Preserve private personality documents' `form-action 'none'` by linking to signup on its ordinary page.

Exercise automatic reveals by scrolling instead of calling `prepareNext` from the test. Verify that the poster remains visible and Continue works when a background page fetch stalls or fails, including mobile and Save-Data mode. Optional font caches must not block rendering; cover corrupt cached bytes, stalled storage, and recovery after a transient network failure.

For mobile interstitials, exercise the initiating click/focus and sample horizontal overflow throughout entrance animations. Checking only the settled modal can miss overflow from the underlying row's hover zoom or overshooting decoration. Keep keyboard focus from panning the page while the card animates.

Keep oversized decorative canvases in a separate layer with layout and paint containment so their overscan cannot enlarge the interactive card's scrollable area. Verify card and popover scroll widths with native WebGL: GPU-disabled Chrome can still expose software WebGL on Linux, even when the same local configuration uses a CSS fallback.

For WebGPU or glTF changes, inspect the actual exported assets in Chrome as well as running loader tests. A Blender still can hide missing geometry or inward-facing triangles because its render settings differ from the browser's back-face culling. Check every journey sculpture, reduced-motion/static fallback, and resource disposal after navigation; mock GPU tests alone do not compile WGSL or prove the result is visible.

For figurative sculpture, compare front, profile, and three-quarter views against real references before polishing materials. Preserve a detailed source mesh and simplify an export copy; inspect disconnected fragments and non-manifold edges instead of treating a successful export as visual acceptance. Record the source and license for any reused geometry, including attribution and modification notes.

For a distinct sculpture derived from an existing one, reuse its anatomy and material style while changing the composition and silhouette. An accessory on the same bust is not a fresh model. Compare the full series before exporting.

For scripted Blender builds, pass `--python-exit-code 1` before `--python` in both outer commands and child processes. Blender otherwise exits successfully after Python exceptions, which can hide failed validation and package stale assets.

# Journey performance

Use `scripts/JOURNEY_PERFORMANCE.md` and the native Chrome profiler for changes to the feed → article → shop → coach → subscribe → feed cycle. Freeze the baseline release binary and compare cold and warm laps on the same quiet host, Chrome version, native GPU, 390×844 touch viewport, DPR 2, 4× CPU, and shaped 4G. Capture each lap uninterrupted, starting before navigation, and identify each leg with phase marks. Preserve raw traces and record hardware, served asset hashes, encoded transfer bytes, and per-leg results. Trace actual presentations and TouchScroll dropped/checkerboarded frames; RAF frequency alone does not prove 60 fps. Measure sculpture submissions separately. Isolate the actual visible poster fade from opaque content preparation and idle time. Never describe desktop CPU/network emulation as physical Android certification. Page-target throttling does not shape a service worker's separate network requests: bypass it for the comparative cold fixture and verify ordinary service-worker behavior separately.

Run the profiler's `--assert` budgets for the candidate and inspect failed traces before changing code. Check a long article as well as the latest article. Keep the normal/reduced-motion Chrome fixtures, Save-Data and unavailable-GPU fallbacks, retained-page restoration, interrupted navigation, visible-image/font readiness, and resource disposal. A slow transition must remain covered until content is ready; do not raise the readiness timeout or skip visible-image decoding to hide network problems.

Check main-thread long tasks after the destination settles as well as during scrolling and the exact fade. A clean fade can be followed by expensive optional diagram work that stalls the visible page. Require no settled main-thread long tasks, while allowing a static page to stop scheduling frames; idle frame frequency is not an animation budget.

Keep continuous scroll/render frames free of layout measurements and repeated synchronous progress storage. Cache geometry through ResizeObserver and explicit mount/viewport/font invalidation; batch all reads before DOM writes. Persist article completion once, resetting that cache when the reading lap resets. Reveal animation should update local transform and opacity; keep clipping radius and large shadows static. Fit sentence titles with bounded measurements and a font/text/box cache, and verify real overflow after font recovery and resizing. Prepare one inert destination and preload its local bundles concurrently without executing them before promotion. Hydrate optional sandboxed previous-page snapshots only during idle time, cancel pending work on dismissal/navigation, and preserve their original scroll position and script isolation. Fixed feed controls and resume cards must yield to the revealed poster; verify Continue hit testing and restore the controls when the reader scrolls back.

Before asserting zero geometry reads during stable scrolling, establish managed/native font readiness and unchanged native ResizeObserver dimensions across rendered frames. Navigation settlement or two RAF turns alone can precede a legitimate layout invalidation. Content-visibility intrinsic sizes can change when bottom sections become visible. Keep zero-read and zero-repeated-storage assertions strict during sampling, and record callback stacks, font events, and observed dimensions on failure; do not ignore cache refreshes or retry whole fixtures until they pass.

Prepare snapshot theme, stylesheets, and decoded fonts before inserting its copied body. Restore the outgoing scroll position and decode visible images before marking that optional preview ready. Contain layout and paint in both its bounded viewport and scaled iframe. Trace settled destinations as well as fades: a late thumbnail raster can produce missing pixels after a clean handoff. Attribute missing content to actual presentation timestamps, deduplicating forked native reports; accumulated parent-sequence flags cannot identify which phase failed.

Make snapshots static beyond CSS: pause SVG animation timelines and discard inherited animation layer hints and identity transforms. Otherwise a small thumbnail can retain thousands of pixels of marquee layers and repaint every display frame. Set thumbnail scaling before attachment and verify the original child viewport, scroll position, typography, and scaled bounds in native Chrome. CSS zoom changed the child viewport in the native fixture; retain transform scaling unless a replacement proves the same layout. Do not replace this proof with an opacity workaround or fixed delay.

Changed sculpture poses should draw at display cadence; do not add a 32 ms throttle. Stop scheduling frames when poses settle or decoration is offscreen, hidden, reduced-motion, disposed, or behind the next curtain. Cache canvas sizes and native resource views. Transfer strict GLB decoding to one bounded worker with cancellation, timeout, idle shutdown, and equally validated cooperative fallback; verify its same-origin script under the production CSP. Evaluate invariant work once per frame rather than per vertex/pixel. Profile encoded model transfer before changing geometry; preserve full marble shading, shadows, geometry, and antialiasing unless native browser inspection establishes a justified visual tradeoff. Phone canvases currently cap at 800 px/DPR 1.5; inspect the whole sculpture series before changing that budget.

Profile procedural geometry construction separately from shader compilation and GPU upload. Preallocate packed typed arrays and reuse ring grids instead of allocating arrays for every triangle. Cache immutable CPU geometry across remounts while creating and disposing fresh GPU resources for each mount. Preserve topology, winding, normals, UVs, and materials with byte-for-byte reference tests and native rendering checks; a fast shader can still be followed by a long synchronous mesh-generation task.

Article SVGs are authored primary content and may render before the optional WebGL enhancement. Compile a scene-specific shader using `KHR_parallel_shader_compile`; poll `COMPLETION_STATUS_KHR` before querying link status or uniform/attribute locations. Immediate status queries can synchronize the driver. Keep compilation and animation suspended while a destination commits or its hero is invisible, and release pending work on disposal/context loss. Check every article's actual GLSL scene, theme colors, static fallback, and context restoration in native Chrome after changing the shared renderer. See the [extension specification](https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/).

Gate browser enhancement assertions on the complete renderer capability, including its asynchronous-compilation extension. Software Chrome can expose WebGL2 without `KHR_parallel_shader_compile`; verify visible authored SVG graphics and a hidden unused canvas in that case, while retaining real shader-draw and palette assertions when the extension exists. Wait for fonts before scrolling the hero or graph into its verification viewport.

Do not import and render every article diagram on mount. Enhance visible diagrams during idle time, outside reading gestures and journey exposure or commits, and serialize one figure at a time. Preserve original sources and readable fallbacks, reuse unchanged SVGs on retained mounts, and invalidate for theme or compact-layout changes. Cancel observers and pending work on disposal and recheck eligibility after asynchronous imports and fonts. Keep native SVG labels for the authored plain-text flowcharts and verify actual glyphs fit inside their node shapes. Exercise actual diagrams by scrolling in native Chrome, including expansion, theme/layout changes, retained-page controls, and cancellation; mocked Mermaid output or valid graph bounds alone do not prove the diagrams remain usable.

Keep catalog cards and thumbnails responsive. Run `scripts/resize-shop-images.sh` after updating lossless cap originals; commit the 160/384/640 px derivatives with matching `srcset`/`sizes`. Catalog tests enforce per-image transfer budgets of 16/60/140 KB respectively. Prewarm only a bounded first row using the browser's responsive candidate, prioritize images actually visible at promotion, and retain their decode gate. Do not eagerly download every full-size gallery view or all adjacent products; respect Save-Data and retain the 900 px originals for detail. Verify selected mobile candidates and encoded bytes over cold 4G, including image quality and product navigation.

Do not request payment providers on storefront mount or journey prefetch: asynchronous script loading still executes on the main thread. Load Stripe only for bag/checkout intent or a payment redirect return; coalesce requests, bound failures, allow retry, and ignore the result after its storefront unmounts. Recover existing payment returns even when new orders are disabled, including an in-page retry after a failed provider request. Browsing the complete cycle should make no payment-provider request. Exercise retry, return, and disposal with a local stub without making real payments. When changing provider URLs or policy, verify admission against the served production CSP separately: a stubbed script append does not prove native CSP admission.
