# CSS compression evaluation

`scripts/eval-css-site.mjs` compares a frozen website release with upgrade-only,
guard-only, naming-only, and compact candidates. It measures the actual delivered HTML,
CSS, and JavaScript together: saving CSS while expanding every HTML class list
is not sufficient evidence of a smaller page.

The baseline is the release built from main
`2061afa3aad1577e56f95cf665b49a3462f5d890`, copied to
`/tmp/engmanager-css-baseline-website` before adapter edits. Its SHA-256 is
`90bc3052acbd7eab31dc0c2e8dddd94bf12377a54a227d4131283d50b76ed62e`.
Keep that file and its capture directory immutable. Run it from `/tmp` so the
repository's dotenv files are not loaded; unset `STRIPE_SECRET_KEY`,
`STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `KIT_API_KEY`, `KIT_FORM_ID`,
and `NEWSLETTER_UNSUBSCRIBE_SECRET`. No evaluation submits a form or payment.

Freeze each subsequent executable to a fresh file, verify its SHA-256, and
start the matching server only after its HTTP health check succeeds. Never
overwrite an executable that a running server has mapped; use a fresh inode
and an atomic rename or a unique digest-bearing filename. Preserve the
manifest and source hashes from that exact build beside it.

The initial complete inventory is at
`/tmp/engmanager-css-baseline-full-inventory/report.json`: 49 HTML route/state
cases and 64 distinct declared CSS/JS assets. It includes the sitemap, feed,
shop, solo/group coaching, newsletter privacy and unsubscribe, search states,
all 18 product paths, six published personality steps, and shop-host checkout
documents. The finite route inventory is explicit; it does not represent
every possible search query, bearer URL, or arbitrary 404 URL.

The upgrade-only control is frozen at
`/tmp/engmanager-css-upgrade-control-website` with SHA-256
`aa5cf912e31483d309ee2247def7c85782b823f96a0811845f08cf06386796d1`.
It changes only the Lightning CSS dependency to alpha 72. Its 49-route
inventory at `/tmp/engmanager-css-upgrade-control-inventory/report.json`
has byte-identical declared CSS/JS bodies. Combined route totals are identical
except `/search`, whose empty-query result order differs between server
processes: its raw HTML length is unchanged, with 2 fewer Brotli bytes and 3
fewer gzip bytes. That difference is content ordering, not compiler savings.

The guard-only control uses `ENG_CSS_MODE=baseline`: no naming or factoring,
but the compiler's temporary AST rule boundaries prevent an upstream alpha 72
minifier defect. The boundaries are removed before printing. The standalone
stock-versus-guard reproducer found five dropped valid tail declarations in
512 stock builds; the compiler's authored-source/native controls verify the
guarded result. This is correctness work in the minifier, not a naming or
factoring saving. Report original → upgrade, upgrade → guard,
guard → naming, and naming → compact deltas separately before assigning credit.
The frozen website guard control's precise source/runtime changes and digest
must be recorded when it is built; do not describe it as the stock upgrade.

The selected baseline native matrix is saved at
`/tmp/engmanager-css-baseline-native-selected/report.json`: 96 cases across the
homepage, Gmail article, shop, coaching, subscribe, and personality preparation
surface, covering both viewports/themes/motion settings and cold/warm loads.
All have zero uncaught page errors and horizontal overflow. Chrome is
154.0.8037.93 on the actual host GPU. This is selected native coverage, not an
all-route or candidate acceptance claim. A baseline-versus-itself mobile,
light, reduced-motion cold/warm control at
`/tmp/engmanager-css-native-self-control-v2/report.json` found no strict
DOM/style/geometry differences. The exploratory readiness timings were
captured during other source/build work and do not establish a speedup.

Run an inventory without starting Chrome:

```sh
node scripts/eval-css-site.mjs \
  --baseline-url=http://127.0.0.1:3191 \
  --mode=inventory \
  --output=/tmp/engmanager-css-baseline-inventory
```

Run the complete 49-route body inventory against all frozen binaries. Controls
are attribution evidence and are not independently required to save bytes:

```sh
node scripts/eval-css-site.mjs \
  --baseline-url=http://127.0.0.1:3191 \
  --upgrade-control-url=http://127.0.0.1:3192 \
  --guard-control-url=http://127.0.0.1:3195 \
  --naming-control-url=http://127.0.0.1:3193 \
  --candidate-url=http://127.0.0.1:3194 \
  --guard-control-manifest=/absolute/path/guard/css-compact-output.json \
  --naming-control-manifest=/absolute/path/naming/css-compact-output.json \
  --candidate-manifest=/absolute/path/compact/css-compact-output.json \
  --mode=inventory \
  --output=/tmp/engmanager-css-final-inventory \
  --assert
```

Use the same five URLs/manifests without `--mode=inventory`, with
`--visual-routes=/,/articles/your-gmail-avatar-is-part-of-your-job-search,/shop,/coach,/subscribe,/personality/prepare`
and a fresh output directory for the paired native cohort: all 49 routes still
have exact body totals, with 96 native cases per variant. Keep `--assert` on the
final candidate run. A baseline/self, neutral upgrade, or guard control run
uses no `--assert`, because zero savings is valid for those controls. Inspect
their strict comparison summaries instead of interpreting a savings-gate
failure as a CSS-equivalence failure.

The default matrix uses 390×844 touch/DPR 2 and 1440×1000 desktop/DPR 1,
light/dark themes, normal/reduced motion, and cold/warm hard navigations. Each
route/theme/viewport/motion combination starts in a fresh Chrome browser
context. Its warm capture reuses that context, HTTP cache, and font storage.
It is not a same-document journey lap. Root service workers are bypassed in
this comparative fixture; ordinary worker behavior remains a separate native
functional check. Chrome uses its actual GPU without SwiftShader overrides.

`--routes=/,/feed,/shop` restricts both inventory and native cases for a focused
check. `--visual-routes=/,/shop,/coach,/subscribe` keeps the complete byte
inventory while limiting screenshots and DOM probes. `--themes`, `--viewports`,
`--motion`, `--cache-modes=cold`, and `--repeats=3` set an explicit cohort. Do not
describe a selected cohort as an all-route native pass. To compare a later
candidate without replacing baseline artifacts, pass
`--baseline-report=/absolute/path/baseline/report.json` and its candidate URL.
Final native baseline reuse requires a matching probe contract, raw snapshot
fields, Chrome/GPU configuration, and cohort keys. The older selected baseline
has compatible structural/class/geometry fields but no saved harness digest.
The current probe additionally records insets, filter/perspective, and flex/grid
properties; recapture the 96 baseline cases for final acceptance. Preserve the
older raw evidence and timings as exploratory artifacts. Report schema 2
records both the full harness SHA-256 and the capture-probe contract SHA-256.
Saved native baseline reuse rejects missing or different hardware, Chrome, GPU,
and cohort provenance before capturing another variant.

For every route the tool preserves identity-encoded HTML and the required
local CSS/JS bodies, along with SHA-256 hashes and response headers. It
compresses each response separately using Node Brotli quality 5 and gzip level
9, records the Node/zlib versions, and sums HTML plus asset bodies. Those are
exact compressed body sizes under the stated settings; they exclude HTTP
headers. `htmlPlusDeclaredCssJs` covers stylesheet links and script sources in
the delivered HTML. `htmlPlusObservedCssJs` additionally covers local CSS/JS
requests observed in the page target before inspection. Browser
`encodedDataLength`, cache/source flags, and native ResourceTiming are retained
separately. Neither page-target network events nor ResourceTiming invent
statistics for unobserved worker or iframe targets. Inline CSS/JS is already
included in the HTML body.

The native transfer gate independently reads the saved main-frame
NavigationTiming and ResourceTiming entries. It sums the document's reported
`transferSize` plus exactly one completed same-origin entry for every local
stylesheet link and script source declared in that document. Other preloads,
prefetches, transitive imports, workers, iframe requests, images, fonts and
optional readiness-dependent work are excluded. This bounded cohort measures
the actual cold/warm cache behavior of the representative pages; it does not
claim whole-session network usage. Chrome's `transferSize` includes its
300-byte response bookkeeping, rather than literal HTTP-header bytes, and is
kept distinct from recompressed body sizes and CDP `encodedDataLength`.

Missing, duplicate, unfinished or privacy-obscured measurements fail instead
of contributing zero. The navigation must have completed, each asset must
have its expected stylesheet/script initiator, and positive encoded sizes
and decoded sizes matching the frozen inventory establish complete response
measurements. A genuine cache hit can then contribute zero transferred bytes.
The report retains document/CSS/JavaScript totals, each asset's native entry,
cache mode, snapshot source and matched-case deltas. The transfer gate itself
does not change capture probes, readiness or cohort presets. The later RSVP
inspection policy below changes the probe contract, so the earlier 96-case
baseline at `/tmp/engmanager-css-final-native-baseline/report.json` is historical
evidence and cannot be reused for a new native comparison.

The content fingerprint removes class attributes, compiled asset hashes,
compiler-generation metadata, and script/style bodies. A remaining mismatch
flags non-CSS content or markup changes that need attribution; it never
changes the exact body bytes or silently exempts a growing route.

Native readiness requires returned typography promises, native loaded fonts,
visible image decoding, navigation settlement, visible native date-countup
completion, and six unchanged native ResizeObserver frames. Within the same
15-second deadline, the tool selects visible `[data-date-countup]` nodes once
after font/image and document readiness, records their native state changes,
and waits for them to leave `pending`/`running`. It does not sleep for three
seconds, alter the animation clock, or settle offscreen pending dates. This
wait is included in readiness timing, so that timing is not an isolated CSS
parse/layout measurement. The probe samples rendered content and hidden surface
roots; it omits the descendants of `display:none` surfaces whose internal
tooltips and receipt data can legitimately differ between runs. Date descendants
follow the same snapshot rules as other elements, including exact classes,
styles, and geometry for generated labels and accessibility spans on offscreen
pending dates. Only the `time[datetime]` element’s own text is normalized to its ISO
`datetime` attribute for semantic comparison; descendant text is preserved.
DOM addresses use element positions and tag names, not class selectors. The manifest's
schema is version 1 and `CompiledProject` contains `manifest`, `stylesheets`,
`bindings`, `report`, and source maps. Its `classes` map expands an authored
class into the complete generated token list; `identities` contains only
owners whose identity remains. The binding oracle expands each baseline
element's authored class set through `classes` and checks the candidate's
exact token set. It catches missing/extra atoms while allowing a correctly
elided static identity. Identity inversion alone cannot recover those owners.
The served `eng-css-generation` must match for every route importing a project
stylesheet or carrying a generation marker. Published personality and
self-contained offline/error CSS boundaries remain separate; a missing
generation on an ordinary route importing managed CSS still fails.

For a reproducible CSS inspection phase, finite native CSS animations finish,
infinite native CSS animations pause at time zero, and native SVG timelines
pause at zero. The tool then re-establishes font/image/native-size readiness.
Before this phase, a coach reader in Speed mode uses its actual Pause and
Restart controls, observes the first real nonzero progress mutation, and
immediately uses Pause again. The authored headline's second word identifies
token 1. The report records the original state, restart state and paused state;
the snapshot independently verifies unchanged text, progress fraction, persona,
speed, stopped playback, stopped play intent and the toggle's `Play` ARIA label.
The observation has a bounded 15-second deadline, without a fixed sleep, a
clock override, or an inline-style write. A stalled reader, wrong token or failed
Pause rejects capture. Read mode, including the reduced-motion default, remains
untouched. Timing counters are sampled before these inspection-only controls.

This prevents a live token timer from starting a new 180 ms progress transition
after the finite-animation pass. The previous four normal/warm coach transform
differences appeared identically in upgrade, guard, naming and compact controls;
they sampled that native transition at different phases. They remain historical
failed captures. The nonzero paused target keeps wrong scale axes, multipliers,
translations and origins observable. Transform and geometry receive the usual
strict comparison, together with transition property, duration, easing and
delay; the progress element receives no animation exemption. Reader state is
also compared exactly between matched snapshots. The policy and executed
source enter `probeContractSha256`, requiring a fresh full five-variant cohort
instead of normalizing the old snapshots or reusing their baseline.

Other JavaScript animation and GPU rendering stay real. Screenshots are inspection
artifacts, not pixel-equality gates. The JSON compares exact compiled class bindings, text,
computed properties, pseudo-elements, and geometry with a 0.75 px tolerance.
An asynchronous GPU fallback/canvas opacity handoff is retained as an explicit
`gpu-state-review` difference when the actual renderer state differs. It is
not a CSS parity failure or proof of successful GPU enhancement. Native
renderer, interaction, transition, fallback, and disposal fixtures are still
required. Any different opacity with the same renderer state fails normally.
The normal-motion DVD bouncer's actual translated position is likewise a
`js-animation-review`; its dimensions, layout rules, and same-tone palette
remain strict comparisons. No application RAF or clock is overridden.

The final candidate assertion gate rejects **both Brotli and gzip growth in
any matched route's HTML plus declared CSS/JS**, and requires positive aggregate
savings in both codecs. A zero aggregate delta fails the savings gate. The
aggregate is the equal-weight sum of the inventory's per-route cold totals:
shared CSS/JS bodies count once within each route and again for another route.
It is not a cache-warm browsing session, a traffic-weighted estimate, or a sum
of unique website assets. Raw body sizes and observed-load totals remain
reported separately. Missing routes/cases, native binding/structural/style/
geometry differences, uncaught page errors, and horizontal overflow also fail.
Each matched native cold **and** warm case additionally requires the actual
document-plus-declared-assets transfer sum to be no larger than its baseline.
Equality is valid for native transfers; the separate positive aggregate
Brotli/gzip body-savings requirement still applies. The retained regression
at `/tmp/engmanager-css-warm-coherence-counterexample/report.json` demonstrates
why both gates are necessary: the homepage's cold transfer shrank, while its
warm document refetch grew from 0 to 12,727 bytes. Subscribe's warm transfer
grew from 7,926 to 8,510 bytes. Both warm regressions fail the native gate even
if recompressed cold bodies pass.
Review artifacts identify the
exact DOM address, property, semantic classes, and before/after values.
Animation/GPU reviews remain visible instead of being silently discarded.
`--assert` requires a matched original-to-candidate comparison and applies to
that candidate; the controls remain attribution evidence and do not have to
save bytes. Naming and factoring gains must be
attributed relative to the guard-only and naming-only controls respectively;
the upstream guard receives no naming/factoring credit. The report’s
`compressionAttribution` ledger gives the adjacent original → upgrade → guard
→ naming → compact route and aggregate deltas, including HTML/CSS/JS components.
These are arithmetic attribution records; native comparisons still use the
original authored-class baseline. Timing distributions report
sample counts, native navigation/paint/readiness, and recorder overhead
separately. Native page-target style/layout counters are sampled before the
large computed-style probe and explicit CSS animation phase changes. They
include the readiness probe and exclude worker/iframe targets. Local
unthrottled CSS inspection is not a
mobile performance result or physical Android certification. Journey changes
still use `scripts/JOURNEY_PERFORMANCE.md` under a separate quiet capture.

`node scripts/eval-css-site.mjs --self-test` verifies asset parsing, manifest
decoding, compression, geometry tolerance, and strict comparison behavior
without Chrome. It also verifies a complete zero-byte warm cache hit, rejection
of a new warm document transfer, and failure on incomplete, ambiguous or
prefetch-only declared-resource evidence. A baseline-versus-itself native control is required before
using a candidate comparison to attribute a difference to compression. The
self-checks execute the reader control policy itself, including deadline,
wrong-token and failed-Pause counterexamples, and prove that wrong transforms,
transition durations and progress states fail at the same nonzero phase.

The separate journey and native hero/diagram tools accept
`--css-manifest=/absolute/path/css-compact-output.json` for a compiled release.
Omit it for the ordinary original/upgrade-only binaries. The profiler uses
existing data/role hooks and records the supplied generation and manifest
digest; its gestures, phases, analyzer, and budgets remain unchanged. Hero
fixture markup expands its explicit authored class lists. Diagram QA resolves
only known application identities, while keeping Mermaid's own SVG namespace
literal. Unknown bindings, elided observed identities, and a manifest from a
different served generation fail explicitly. The shared binding helper never
rewrites arbitrary source or JavaScript strings. Run its direct checks with
`node --test scripts/css-manifest-bindings.test.mjs`.

For the frozen compact release, run these fixtures separately from one another
and from the native CSS cohort:

```sh
node --max-old-space-size=8192 scripts/profile-journey.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --passes=2 --cpu=4 --output=/tmp/css-compact-journey --assert
node scripts/verify-article-heroes.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/css-compact-heroes
node scripts/verify-article-diagrams.mjs --url=http://127.0.0.1:3194 --css-manifest=/absolute/path/compact/css-compact-output.json --output=/tmp/css-compact-diagrams
```

Guard-only port 3195 and naming-only port 3193 use their respective saved
manifests. The evaluator itself takes the variant-specific
`--guard-control-manifest`, `--naming-control-manifest`, and
`--candidate-manifest` arguments shown above; `--css-manifest` belongs to the
three separate native tools. Preserve their independent harness, probe,
binding-helper, manifest, and analyzer fingerprints.

Candidate savings and full native acceptance remain pending the frozen
guard-only, naming-only, and compact releases and the final paired capture. A smaller raw CSS file alone
is not an acceptance result.
