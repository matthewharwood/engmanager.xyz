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
