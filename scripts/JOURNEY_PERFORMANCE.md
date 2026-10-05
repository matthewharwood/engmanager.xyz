# Reproduce the mobile journey profile

Build and run a release website binary locally; release embeds the exact JS,
CSS, models, and article HTML being tested. Run from a directory without local
secrets, with payment/newsletter credentials unset. Use a fresh Chrome profile
for each comparison, the same Chrome version, and the same quiet host. Freeze
the baseline release binary before rebuilding the candidate. A debug binary
reads generated assets from disk, so copying only that binary does not freeze a
baseline. For a CSS-adapter build, preserve its full `css-compact-output.json`
from Cargo's `OUT_DIR` beside the frozen binary as well.

```sh
cargo build -p website --release
# Start the binary on a local port, e.g. PORT=3092 /absolute/path/to/website.
node --max-old-space-size=8192 scripts/profile-journey.mjs --url=http://127.0.0.1:3092 --css-manifest=/absolute/path/compact/css-compact-output.json --cpu=4 --passes=2 --label=commit-or-diff-id --output=/tmp/journey-candidate --assert
node --max-old-space-size=8192 scripts/analyze-journey-performance.mjs /tmp/journey-candidate/report.json
```

`CHROME_BIN` or `--chrome=/absolute/path` selects Chrome. The default is native
macOS Chrome. The harness enables native GPU rendering rather than disabling
GPU or substituting SwiftShader. `report.json` records Chrome's actual adapter,
browser version, CPU/network/viewport settings, and served asset fingerprints.
Reject a run that did not initialize a WebGPU sculpture, has horizontal
overflow, or hard-navigated after a failed same-document promotion. The report
records hard-navigation fallbacks and their errors so a slow failure cannot be
misreported as a smooth transition.

Use `--css-manifest` for every adapter-built compact, naming-only, or guard-only
binary, passing the file frozen with that exact release. Omit the option for
the original release and stock upgrade-only controls, which have no adapter
manifest. `ENG_CSS_MODE=baseline` is the adapter's guard-only control, distinct
from the original frozen baseline. The probe uses existing data/role hooks,
checks the supplied generation at its asset-fingerprint reads, and records the
manifest and binding-helper digests separately from harness/analyzer source
fingerprints. Binding or generation changes do not change gestures, phases,
trace interpretation, or performance budgets. See
[`_docs/css-compression-evaluation.md`](../_docs/css-compression-evaluation.md)
for the separate five-variant rendered-body and native CSS comparison.

Use `--assert` for the candidate on a quiet host. It requires successful same
document promotion, an active same-origin sculpture decoder Worker, at least
180 native expected/presented scroll frames per
leg, no checkerboarding/missing content, at most 5% dropped touch-scroll frames,
presentation p95 at most 20 ms, no scroll presentation stall over 50 ms, no
main-thread long task during the warmed gestures, and sculpture submission p50
and p95 at most 20 ms with no interval over 50 ms, measured separately inside
each gesture so the intentional idle
pause between gestures is preserved in the full distribution without being
called active animation jank. The actual 620 ms poster handoff must also have
at least 30 expected compositor frames, at most 5% drops, no missing pixels,
compositor draw p95 at most 20 ms, and no stall over 50 ms or main-thread long
task. A native `Element.animate().finished` observer marks that exact visible
fade, separately from opaque mounting/readiness work. The small scheduling
tolerance around a 16.67 ms display interval
accounts for trace timestamp jitter. These are comparative fixture budgets,
not a replacement for physical-device tracing. Keep the complete distributions
and failed traces when a budget fails; do not rerun until a lucky result passes.

The fixture uses a 390×844 touch viewport at DPR 2, 4× CPU throttling, 4 Mbps down,
1 Mbps up, and 120 ms latency. The first lap has a cleared HTTP cache; the second
reuses it. Each lap exercises feed→latest article→shop→coach→subscribe→feed with
real CDP touch scrolling and taps. `--cpu=2` provides a less conservative CPU
comparison. `--article=the-execution-marketplace` seeds the prior reading
progress and exercises a longer article without changing the real transition.
The HTTP-warm lap starts with a new document, so it resets per-document CPU
caches. It does not prove retained geometry reuse.

For every leg, it records the initial reveal, model loading, six continuous
scroll gestures after the model initializes, promotion through mount/fonts/
visible-image readiness, and a settled viewport. PNGs verify both the actual
sculpture and destination. Compressed Chrome traces are preserved for Perfetto
or DevTools; `phases.csv` contains per-phase comparisons. Each lap is one
uninterrupted trace begun before navigation. Chrome snapshots tracing enablement
when constructing a FrameSequenceMetrics object; restarting tracing for each
leg can leave retained trackers unrecorded. The analyzer assigns cumulative
native frame-counter deltas by actual presentation, including sequences that
span phase boundaries, instead of charging their entire totals to a start mark.
It also handles per-gesture counter resets and the nested reuse of adopted
native trace IDs. The larger Node heap accommodates native lap traces. Because
a lap can exceed V8's single-string limit, the bounded parser reads event
objects from UTF-8 bytes. It retains all named task/style/layout/paint/parse/
compile/raster/script/GPU metric spans regardless of duration, all native frame,
worker, network and phase evidence, and other attribution spans of at least
0.5 ms. Only analysis omits irrelevant tiny attribution spans; the complete
original compressed trace is preserved for independent review.

Chromium can merge older expected/drop counters into a short sequence's
termination summary; see its [Merge and Terminate implementation](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/cc/metrics/frame_sequence_metrics.cc).
The analyzer normally uses a complete parent summary to protect against
overlapping adopted children. Its narrow exception requires a fresh child
chain starting at expected1/drop0/last_sequence0, consecutive native sequence
numbers and counters, continuous presentation intervals, and a final child
end equal to the parent end. If only that termination summary gained older
history, it uses the proven child counters while retaining actual child drops.
Missing metadata, a reset, gap, or incomplete chain keeps the parent authority.
Each sequence records its raw parent, selected counters, and provenance;
`report.analysis` fingerprints the exact analyzer/parser source. Use the same
analyzer on both saved baseline and candidate traces, preserving prior report
versions and their original CLI assertion outcomes.

Missing pixels are attributed by each native `PipelineReporter` presentation
end, rather than a multi-second parent sequence's accumulated flags. Forked
main/compositor reports and multiple layer-tree hosts at the same display
timestamp count as one presentation; their individual flags remain in the
report. `pixelWarnings` at both leg and report level also exposes missing
content outside the scroll/fade budgets. The settled destination must have no
missing pixels or main-thread long tasks, so a clean curtain fade cannot hide a
later incomplete frame or blocking diagram render. There is no idle-frame-rate
requirement: an idle destination should stop producing unnecessary frames.

For attribution only, `--passes=1 --legs=1 --diagnostic=observe` records native
hero first-draw/renderer and previous-iframe population/font events.
The iframe observations include native PaintTiming entries, with their actual
child-document timestamps, plus readiness, original viewport size, scale, and
scroll. PaintTiming is attribution evidence; it does not prove that all GPU
tiles were ready for presentation. Keep the native missing-pixel flags as the
budget's authority.
Compare separate cold captures with `--diagnostic=hold-preview` or `hold-hero` to isolate
one feature at a time. These controls deliberately alter the application and
cannot be combined with `--assert`; they are never passing performance results.
To prove the newsletter's separate per-document geometry cache, add
`--passes=2 --legs=4 --diagnostic=observe --armillary-remount` to a focused run.
After each four-leg lap ends at Subscribe, the fixture taps its native Resume
control to return to Coach, scrolls the returning poster, and taps Continue
back to Subscribe. It verifies that this revisit retains the same document
and records native pipeline-resolution/first-vertex-buffer timestamps in
`armillaryCacheRevisit`. Compare the first construction with this same-document
revisit; the extra route is diagnostic only and is absent from the production
latest/long-article performance protocol.

Worker proof combines the native constructor URL, successful decoded typed-array
replies matching transferred jobs, a live worker CDP target, and evaluation of
that exact served script on a DedicatedWorker thread in the trace. Chrome154
may expose an empty target URL; neither that metadata field alone nor a mocked
Worker is sufficient proof. The probe observes native operations without
changing their arguments or returned values.

Inspect `trace.presentation` (`AnimationFrame::Presentation` on the target
renderer), native `FrameSequenceTrackerV3` TouchScroll expected/dropped/
checkerboard counts, and scroll presentation events. These are separate from
RAF callback intervals and sculpture-specific GPU queue-submission intervals:
a 60 Hz callback can still submit a sculpture at 30 fps. Main-thread
task/style/layout/paint costs are
restricted to the marked target renderer; tasks from browser startup or
another process are not charged to the page. Always inspect long-task children
and long-animation-frame attribution before changing runtime code. A settled
page that stops producing frames is desirable; its sparse presentation cadence
is not scrolling jank.

This is comparative native rendering evidence on a desktop GPU with mobile CPU
and network emulation. It cannot certify 60 fps on every Android GPU. Before
claiming device-level 60 fps, repeat the journey on a physical modern Android
phone over shaped 4G, capture a remote Chrome trace, and inspect the same
presentation/drop/readiness evidence. Use system-wide network shaping there:
page-target CDP throttling does not cover network requests initiated by a
separate service worker target. The application precaches only its offline page
and uses a cache-first handler for requested assets. This local fixture bypasses
worker registration and interception so those separate requests cannot silently
escape the cold4G model download's shaper; test normal service-worker behavior
separately.

Keep raw results outside the repository. Commit a compact before/after report
with hardware/settings and limitations when changing journey performance.

For shader specialization changes, compile and capture all twelve authored
article scenes with the actual served bundle in native Chrome:

```sh
node scripts/verify-article-heroes.mjs --url=http://127.0.0.1:3092 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/article-heroes-candidate
```

The local fixture reuses the repository's authored SVGs and served hero CSS/JS.
It verifies normal and reduced motion, checks native GL errors and overflow,
captures each scene, and exercises context loss/recovery with the SVG visible.
Its explicit remount hook also checks that disposed scene renderer state is
cleared. This compile/visual fixture is separate from the journey timing run so
GPU readbacks and screenshots cannot contaminate its frame measurements.
For guard-only or naming-only builds, pass their own matching manifest instead.
The fixture expands its three explicit authored class lists through the
manifest, including safely elided static identities; it uses data hooks for
inspection. Omit `--css-manifest` when verifying the original/upgrade controls.

For diagram scheduling changes, separately exercise the served article bundle
with its real pinned CDN Mermaid module:

```sh
node scripts/verify-article-diagrams.mjs --url=http://127.0.0.1:3092 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/article-diagrams-candidate
```

This unthrottled native functional fixture checks all three authored graphs,
their complete labels and native SVG glyph/shape containment, in desktop and
mobile layouts, normal and reduced motion, theme changes, expanded
view/zoom, retained SVG reuse, and disposal/recovery during a paused import. It
also verifies that offscreen figures do not import Mermaid. CI uses a separate
deterministic same-origin provider to cover scheduling and lifecycle behavior
without depending on CDN availability. Close this fixture's Chrome before a
timing run. Its rendered-content checks do not measure first-time visible graph
layout costs: deferring that work until the figure is visible and input/journey
are idle does not accelerate Mermaid's intrinsic layout. Journey timing covers
promotion and its settled viewport separately from reading each graph.
As with hero QA, guard/naming builds need their own saved manifest and the
original/upgrade controls omit it. Explicit application identity selectors and
the journey state token resolve through the manifest; a missing or elided
observed identity fails before Chrome starts. Existing data/ARIA hooks and
Mermaid's third-party SVG class namespace stay literal. No arbitrary source or
JavaScript string is rewritten.
