# The Big Six-Seven: production implementation

**Implementation record: 19 September 2026. Release and live verification are tracked in [PR #46](https://github.com/matthewharwood/engmanager.xyz/pull/46).** This document describes current source, including the optional reflection workspace and LiteRT-LM integration. The real-model smoke and its quality limitations are recorded in the optional runtime README. It supersedes the earlier research package’s statements that the production controller, storage, share codec, PDF export, and all model integration are future work. The research documents, enhancement proposal and engineering PDF remain design/evidence references, not a current deployment status page.

The product is a local-first self-reflection experience for people in tech. Its battery contains 170 established items: IPIP-NEO-120, the complete 30-item O*NET Mini Interest Profiler, and the 20-item Twenty-Item Values Inventory (TwIVI). “Six-Seven” is the product name. Interests and values are complementary profiles; the app does not assert a validated seven-factor personality model, zero correlation between constructs, an ideal engineer, a clinical diagnosis, or a hiring recommendation.

## Current presentation: v7

The active shell and `/personality/sw.js` now select the v7 presentation. Every
published v1–v6 and optional AI file remains at its original immutable URL.
V7 imports the frozen v1 scientific modules and exact-link decoder; links with
`s`, `r`, or `e` in the query or fragment still open that decoder. The new offline
manifest retains every prior presentation and reuses v6 portrait and tarot
images. Installation remains an explicit library action, with an atomic
`personality-v7-<release digest>` cache and `/personality/.offline-ready-v7`
marker. Existing offline caches are retained.

Optional story records use the existing IndexedDB notes store under
`story-atlas-v2:<draft ID>` with their own compare-and-swap revision. On first
open, a v6 `story-atlas:<draft ID>` note is copied into the new schema without
changing the original. Background answers, birthday, saved draw, and unchanged
preference answers carry forward. The reworded `type-candidate-ei-12-v2` needs a
new answer; its old response remains only in the preserved v6 note. The v7
background schema permits self-descriptions up to 255 characters. All 170
scientific responses retain their existing identities and format. Deleting a
draft removes both generations of its owned notes.

`scripts/personality-release.mjs` verifies the published byte inventory before
generating only the v7 manifest. V7 remains an unpublished development release
until its final bytes are explicitly recorded in the published inventory.
The implementation record below documents the base scientific workflow.

## Routes and document boundary

The Rust/Axum application serves the public introduction and a dedicated assessment shell. Browser modules handle answers, scores, reports, exports, and local persistence. There is no respondent API, account service, or answer database on the server.

| Route | Implemented behavior |
|---|---|
| `/articles/big-personality` | Searchable, indexed long-form article inside the dedicated shell; begins the assessment or opens the local library. Content is `website/articles/big-personality.md`. |
| `/personality` | Temporary redirect to `/personality/prepare`. |
| `/personality/prepare` | Select optional profiles and author-approved portrait pronouns; begin or resume. Big Five is required. |
| `/personality/test` | Five items per page, full instrument instructions, native radio groups, explicit skipping, progress and previous/next navigation. |
| `/personality/review` | All selected items and response labels, unanswered filter, direct item navigation, partial report access and backup. |
| `/personality/report` | Five domains, 30 facets, interests, values, real-data charts, editorial experiments, optional personal reflection workspace, local Letter/A4 PDF and print. |
| `/personality/share` | Inspect selected-score, exact-assessment, or assessment-and-kept-reflection contents, generate a link, copy/share it, or download selected score artwork. |
| `/personality/library` | Resume, report, back up, import, fork or delete local assessments; optional audio, offline installation and browser storage persistence request. |
| `/personality/sw.js` | Module service worker scoped to `/personality/`. |
| Unknown `/personality/*` routes | Dedicated 404, never silently substituted with the blog shell. |

The usual path is introduction → prepare → test → review → report → share. The sidebar permits moving among these steps; the library provides an independent entry into saved work. Answer review can return to any selected item. A report may be partial: access to the report is not confused with completion of every score.

`website/src/pages/personality.rs` owns the shell and allowlisted steps. `website/src/router.rs` registers routes. `website/src/pages/articles.rs` sends the personality article through the dedicated shell; its response marker also protects percent-encoded article slugs. `website/src/assets.rs` serves literal assessment asset paths and the narrowly scoped worker. `website/src/http.rs` applies the privacy boundary.

Assessment documents omit the blog’s RUM, soft router, speculative prefetching, third-party scripts and remote fonts. They enforce `Referrer-Policy: no-referrer` and a same-origin CSP with no remote script/model connection or frame. Inline styles remain permitted for computed chart styling; inline scripts do not. Questionnaire step HTML is `no-store` and `noindex, nofollow`. The article remains indexable. Open Graph metadata uses one generic 1200×630 cover; it never generates a personal score preview on the server.

Entry from the article into the questionnaire performs a full document navigation, placing the new document within the assessment worker scope. Both the main blog navigation and its root service worker respect the assessment boundary. The root worker bypasses assessment routes/assets and preserves the personality worker’s separate cache namespace. The production app also attempts to update an older root worker and remove assessment route entries from recognized legacy blog caches. This is a browser transition safeguard, not a substitute for a deployment verification of the CDN and access-log settings.

## Native client modules

The base modules live under `website/assets/personality/v1/`; Rust embeds and serves them without a separate Node application build. The optional AI runtime has a separate versioned directory, `website/assets/personality/ai/v1/`, and independent download manifest. Model weights are never placed in `website/assets/` or the compiled binary.

| File | Responsibility |
|---|---|
| `app.mjs` | Page controller, safe DOM rendering, navigation, save queue/status, library, share disclosure and user-triggered exports. |
| `bank.mjs` | Frozen item wording, exact keys, scales, source order, response anchors, instructions, attributions and approved TwIVI wording variants. |
| `core.mjs` | Strict state validation, item selection, wording selection and deterministic scoring. |
| `store.mjs` | IndexedDB via locally vendored `idb`, atomic revision checks, active draft pointer, backups, preferences, fork and deletion. |
| `share.mjs` | Strict canonical snapshot/summary codecs, ingress precedence, pinned releases and public-file integrity checks. |
| `report-content.mjs` | Reviewed descriptive content and original editorial experiments; separate from instrument scoring. |
| `report.mjs` | Immutable canonical report model and DOM-safe report rendering. |
| `enhancement.mjs` | Bounded optional context, 24 reviewed cards and deterministic selection rules, ten action prompts, evidence binding and kept-reflection validation. |
| `reflection-ui.mjs` | Context inputs, reviewed suggestions, optional model setup, cancellable draft generation, reader review/edit and explicit keeping. |
| `enhancement-share.mjs` | Exact kept-text `#e=` envelope and reflection JSON export/import. |
| `charts.mjs`, `charts.css` | Actual score/dataset graphics, keyed-answer counts, missingness and accessible numerical tables. |
| `pdf.mjs` | Lazy local PDF generation with embedded fonts, selectable text, vector graphics and citations. |
| `offline.mjs`, `sw.js` | Explicit installation and verified caching of the complete public release and clean route shells. |
| `release.mjs` | Generated release registry and SHA-256 inventory. |
| `ai-cache-config.mjs` | Small generated allowlist/ready-marker metadata for the optional runtime cache; no runtime binaries or model bytes. |
| `style.css`, `fonts/` | Responsive sidebar/shell and local brand typography. |
| `media/`, `licenses/`, `vendor/` | Static illustrations/cues, provenance, font notices and self-hosted dependencies. |

Untrusted state is data, never HTML or an executable path. Report and app rendering use DOM APIs and `textContent`. The controller lazily imports PDF code and offline installation code only when requested. Chart selection and display modes are presentation state; they do not modify scores.

## Scientific computation and interpretation

- **IPIP-NEO-120:** Five accuracy anchors, values 1–5. Positive keys retain the answer; reverse keys use `6 - answer`. Each four-item facet requires 4/4 answers. Each 24-item domain requires 24/24 answers. Complete facets can remain visible when their broader domain is incomplete. Outputs are keyed sums, means and keyed-answer counts. There are no imported norms or percentile transforms. Item 58 retains the official-key “right and wrong” wording; its difference from the development paper’s “right or wrong” is documented and versioned.
- **O*NET Mini-IP:** The complete 30-item instrument, official instructions, labels and attribution are retained. Each five-point activity answer is recoded 0–4; five activities yield each RIASEC sum, 0–20. The app requires all 30 answers before reporting the six interests. Interest is not ability. The report links to [O*NET career exploration](https://onetinterestprofiler.org/p/enter_scores); the reader can manually enter scores there, but the app sends none automatically. Tech examples are separately labelled original editorial material.
- **TwIVI:** Twenty portraits with six similarity anchors, no reverse scoring. Each two-item value has a raw mean. Relative priority is that mean minus the mean of all 20 answers; all 20 are required. The implementation uses `(10 * pairSum - total) / 20`, preserving exact integer arithmetic until division. The ten centered values sum to zero before display rounding. Their mathematical range is −4.5 to +4.5. Negative means relatively less emphasis, not disapproval or low moral worth. The author-approved he/she/they variants change pronouns and required agreement only.

Missing is `null`; skipped is a distinct Boolean flag. Neither becomes a midpoint. Disabled optional modules may retain their answers in a private local draft, but their scores are null and their answers are omitted from public snapshots.

The report includes all five domains and 30 facets, all six interest scales, and all ten values when complete. Definitions do not turn historical facet names such as Depression, Morality, or Intellect into diagnoses, overall moral judgments, or IQ scores. Domain prose uses transparent editorial ranges below 2.5, 2.5–3.5, and above 3.5. These are writing rules about direction on the response scale, not validated psychological thresholds.

Charts show domain means, actual counts of keyed answers, activity sums and centered priorities. The answer-count chart is explicitly not a population distribution or uncertainty estimate. Ties and flat profiles remain visible. There is no combined total score, composite radar comparison across unlike scales, or career assignment.

The visibility/craft reflections offer quieter and more expressive ways to make useful work understandable. They acknowledge opportunity, relationships, incentives and bias. Their experiment selections are saved separately from answers and never affect psychometric scores.

## Canonical state and report API

The exact validated assessment fields are:

```js
{
  v: 1,
  modules: ['big5', 'interests', 'values'], // selected profiles; big5 is required
  wording: 'they',                       // they | she | he
  responses: Array(170),                 // null or integer; 1–5 / 1–6
  skipped: Array(170),                   // Boolean; true requires null response
  cursor: null,                         // or {module, slot}; zero-based source slot
  view: 'instructions',                 // instructions | assessment | review | report
  reportDate: null,                     // or validated YYYY-MM-DD
  blocks: []                            // sorted unique approved experiment IDs
}
```

Slots 0–119 are IPIP, 120–149 Mini-IP and 150–169 TwIVI. Non-instruction views require a valid cursor in a selected module. Unknown fields, invalid dates, inconsistent skips and out-of-range answers are rejected. The current approved experiment IDs are `craft-log`, `quiet-visibility`, `shared-airtime`, and `values-tradeoff`.

```js
const scores = score(state);
const model = createReport(state, scores, keptEnhancementOrNull);
renderReport(root, model);
const {downloadPdf} = await import('./pdf.mjs');
await downloadPdf(model, {size: 'letter'}); // also 'a4'
```

`createReport` returns a recursively frozen model containing coverage, computed scales, interpretation content, experiment selections, report date, sources and instrument/scoring/template versions. Its base report excludes raw response/skip arrays and local identifiers. An optional kept enhancement includes its actual text, model/task provenance, cited evidence, and selected-answer basis used for validation. The displayed HTML and PDF include the kept text and supporting excerpts, which may contain personal details from the reader's input; they do not print the response array or basis string. Unused context notes are excluded. `buildPdf(model, {size, assetLoader})` returns `Uint8Array` bytes for testing; `downloadPdf` wraps that result in a local Blob download. The accessible HTML remains available because the PDF is not certified as tagged PDF/UA.

## IndexedDB and commit semantics

Database: **`engmanager.big-personality`, schema version 1**. Stores are `drafts`, `reports`, `notes`, `preferences`, `instrumentReleases`, and `installedAssets`. The implementation actively uses `drafts`, `preferences`, and `reports`. The remaining names reserve future boundaries. Scientific reports are derived from answers on demand. The `reports` store holds optional context and kept reflection text, rather than a second authoritative response array.

A draft record contains exactly:

```js
{id, revision, createdAt, updatedAt, releases, state}
```

IDs are locally generated UUIDs. Revision starts at 1. Create/save atomically writes the draft and `preferences.activeDraftId` in one transaction. Save requires the expected revision: a stale tab receives `ConflictError`, rather than overwriting newer answers. BroadcastChannel publishes only `{id, revision}` as a notification hint, not answers; readers still validate durable data. Blocked upgrades, a terminated connection, storage failure or unavailable IndexedDB produce visible fallback guidance. The controller reports “Saved” only after the write queue resolves successfully; a failed save preserves in-memory answers for backup/fork.

Opening a shared snapshot decodes it before opening the library; it does not replace or auto-save an existing draft. “Save an editable copy” explicitly forks into a new local ID. Library import also creates a distinct record. Delete removes that draft, its active pointer when applicable, and associated report/note records without deleting other assessments. Navigation/export and asynchronous reflection-save ordering are included in the final integration verification.

Optional context has exactly `goal`, `format`, `minutes`, `example`, `comparison`, `question`, and `history`. Goal/format/time are allowlisted; each free-text field is limited to 1,500 characters. Context is saved explicitly, rather than claiming unsaved textarea edits are durable. A stored reflection row is `{draftId, basis, context, enhancement}`. Reflection save checks the draft revision and updates that revision and row together. The enhancement is shown only when its selected-answer basis matches the current assessment; changing answers cannot silently reuse a previous interpretation. It is possible to keep context without a reflection.

Local backup envelope:

```js
{v: 1, kind: 'big-six-seven-local-backup', releases, state}
```

Answer-backup import accepts canonical JSON up to 65,536 UTF-8 bytes and validates the pinned release and state before creating a record. This export contains all stored assessment answers, including retained answers in deselected modules, plus assessment position and selections. It omits context fields, kept reflections and local record identity/timestamps. It is an answer backup, not an archive of every private note.

The separate reflection JSON export uses `{v: 1, kind: 'big-six-seven-reflection', snapshot, enhancement}`. It preserves the selected-assessment snapshot and actual kept text with cited evidence, with a 32 KiB import limit. Excluded-module answers and unused context notes are omitted. Import recreates a separate local assessment and its kept reflection; it does not recreate uncited notes or the entire context form. Neither export should be described as a full backup of those uncited notes. A browser persistence request is user-triggered and not guaranteed to succeed. Device loss or clearing site data can remove any local content not included in a user-kept export.

## URL contracts

There is no server-side share lookup or revocation service. Link encoding is not encryption or proof that a person answered honestly. A copied link is independently readable by its recipient.

### Full exact assessment snapshot

The share UI creates a route matching the saved view, with a fragment:

```text
/personality/report#s=1.<canonical-base64url-packet>
```

The inner canonical JSON contains `v`, `releases`, `locale`, `modules`, `wording`, packed `responses`, `answered`, `skipped`, `cursor`, `view`, `reportDate`, and `blocks`. Its release tuple pins the three instruments, scoring, content, report template and item order by version and SHA-256. Payload fields never select a URL or executable module.

The 170 responses use three bits each, 64 bytes including validated zero padding. `0` means missing; legal selected responses are 1–5 or 1–6. Independent answered and skipped masks use 22 bytes each. Answers in excluded modules are zeroed in the exported copy; the private draft remains unchanged. View, saved position, date, pronoun choice and selected experiments round-trip. Transient UI details such as an open details panel, chart tab, sidebar width or scroll position are not part of the canonical assessment. Browsing questions in a shared view uses a separate presentation cursor and preserves the imported saved position when re-sharing.

Tokens are limited to 8,192 characters and decoded JSON to 6,144 bytes. The decoder checks canonical JSON and base64url, UTF-8, padding, ranges, masks, exact keys, selected modules, cursor, date, block allowlist and release equality. Duplicate/alternate encodings and unknown versions fail visibly. It does not decompress attacker-supplied data. A `?s=` full snapshot is rejected: full answers use `#s=` only, and the browser does not send the fragment in the HTTP request. A social service still receives whatever URL a user explicitly posts to it.

### Selected score summary

```text
/personality/report#r=1.<canonical-base64url-packet>
/personality/report?r=1.<canonical-base64url-packet>
```

The fragment is the default. The optional query form requires the user to select a disclosure that query scores are visible to hosting logs and preview services. This smaller envelope contains only one to five selected complete Big Five domain means, rounded to hundredths as integers, plus instrument/scoring identifiers, language and `kind: 'raw-mean-centi'`. It contains no facets, interests, values, answers, experiment choices or full report. Its token limit is 1,500 characters. Means are bounded to 100–500 and ordered O, C, E, A, N. Summary views clearly say self-reported, unverified raw means.

### Assessment and kept reflection

```text
/personality/report#e=1.<canonical-base64url-reflection-envelope>
```

This envelope contains the exact `#s` snapshot plus the actual kept reflection, its task/model provenance and cited evidence labels. It preserves text instead of regenerating a draft on the recipient's device. The selected-answer basis and all measured evidence must match the decoded state. It opens read-only without accessing or overwriting the recipient's local draft, and requires no model installation. Its limit is 8,192 token characters; if the complete text is too long, generation fails with JSON/PDF export guidance instead of truncating it. The share disclosure previews kept sections and evidence because excerpts may include private work details. There is no `?e=` query form.

Ingress rejects duplicate or competing summary/snapshot/enhancement parameters and unexpected snapshot-fragment fields. These forms cannot silently compete for precedence. Shared views verify required public release files before rendering. A release mismatch fails closed and preserves existing saved work; it never substitutes a newer questionnaire. Canonical state, scores and saved text are reproducible; pixel layout and byte-identical PDF output across platforms are not promised.

The share page offers explicit Copy, native share sheet, seven external social/email destinations and a selected-domain PNG. It does not send messages automatically. Every server-rendered social preview remains generic. Full fragment links can be long or altered by a social platform; users are told to reopen the final link.

## Offline installation and immutable release

“Make available offline” is an explicit library action. It registers `/personality/sw.js` with scope `/personality/` and asks it to install the exact release. Merely importing `offline.mjs` performs no installation.

The worker downloads every inventoried public asset, `release.mjs`, and six clean route shells. It verifies asset SHA-256 values, reconstructs and verifies the generated manifest source, checks file/route responses, bounds concurrent downloads to four, and stages the result in a temporary cache. Readers use the target cache only after the final ready marker exists. Failure removes staging state rather than announcing partial offline readiness. A waiting worker verifies and commits its complete release before `skipWaiting`; the client then waits for activation before announcing readiness, preserving the previous installed worker during an unsuccessful update. Cache names begin `personality-v1-` and include the release digest; unrelated caches are preserved.

Only clean public route URLs are installation cache keys. Live navigation responses and answer-bearing URLs are never added to that cache. Offline navigation can return the installed clean shell for the same allowlisted path; its controller interprets the current fragment locally. Public release assets use exact allowlisted paths. The `/articles/big-personality` introduction is outside this worker scope and is not promised offline by this installer.

Optional AI runtime installation is separate. It verifies its own allowlisted public files and uses an independent `personality-ai-runtime-v1-…` cache with a ready marker. The base worker knows those paths through small generated metadata and serves only the committed optional cache. Installing the standard questionnaire does not download the roughly 34 MB runtime. The roughly 2 GB model is a user-imported local file, stored in a separate model namespace; neither an arbitrary model URL nor answer-bearing URL becomes a cache key.

`node scripts/personality-release.mjs` generates hashes after final source and provenance changes. During development it is valid to regenerate this unpublished `v1`. After publication, retain every published byte at its original versioned path and publish substantive changes under a new directory. The current decoder supports its exact release, not an archive of arbitrary old versions; future versions must deliberately preserve or implement compatible old-release loading. Hash verification protects reproducibility and detects mismatched files; it is not a cryptographic guarantee against a compromised same-origin server.

## Typography, illustrations, audio and licenses

The web UI self-hosts Atkinson Hyperlegible Next, Source Serif 4 and JetBrains Mono WOFF2 fonts. PDF export embeds subsetted static TTF instances of the same families. Font OFL notices ship in `licenses/` and the PDF vendor directory. `idb` 8.0.3 retains its ISC notice. PDF-lib 1.17.1, fontkit 1.1.1, and pako 1.0.11 are vendored; their source/version notices and modifications are recorded in `vendor/pdf-lib/provenance.json`.

Two generic images and two ElevenLabs sound-effect cues were produced during authoring, without participant answers. Their production copies are byte-identical to the research assets. `licenses/generated-media-manifest.json` records hashes, sizes and actual MP3 durations; `licenses/generated-image-prompts.json` and `licenses/GENERATED-MEDIA.md` retain the prompts and origin. This provenance does not assert that questionnaire licenses license the media. Provider account distribution rights remain an account-owner release check, as recorded in the original asset notes.

Audio is off by default, opted into through the library, played at a quiet volume of 0.15, and never varies with a higher/lower trait score. No runtime ElevenLabs key, generation API call, participant narration upload, image-generation call, or external font request is included.

## Reproducible checks

Run from the repository root with Node 22 or later (CI uses Node 24) and the repository’s Rust toolchain. The test-only package under `scripts/` pins `fake-indexeddb` 6.2.4; it is not shipped as a runtime dependency. Regenerate the **unpublished development** manifest after source edits, then run the tests:

```bash
npm ci --prefix scripts --ignore-scripts
node scripts/personality-release.mjs
npm test --prefix scripts
node --test scripts/personality-ai-runtime.test.mjs
cargo test -p website personality
cargo test -p website --test articles_cta_e2e
```

The core suite tests item/key/anchor fidelity, independent score fixtures, reverse keys, extremes, incompleteness, centered values, strict state validation, exact snapshot round trips, excluded-module privacy, malformed payload rejection, selected summaries and release hashes. The suite auto-loads the installed `fake-indexeddb/auto`; missing dependencies fail instead of quietly passing storage checks. Its four transaction tests require IndexedDB and should report zero skips in the supported test setup.

For an existing external test dependency, the core suite also accepts an explicit path. The original storage verification used:

```bash
FAKE_IDB_MODULE=/private/tmp/big-personality-test-deps/node_modules/fake-indexeddb/build/esm/index.js \
  node --test scripts/personality-core.test.mjs
```

That command verified **16/16 tests, zero skips**, including reopen persistence, concurrent compare-and-swap writes, explicit fork/import/deletion, active selection and bounded preferences. The normal portable setup is the locked `npm ci` command above; the `/private/tmp` path is only the original local test dependency. CI runs the combined tests, regenerates the release inventory, and rejects a checked-in manifest diff.

A **pre-enhancement checkpoint** verified 32/32 combined tests, zero skips: 16 core/storage, 11 offline and five report/PDF. Those counts do not describe the current expanded suite. The offline suite exercises clean-shell installation, all asset hashes and manifest bytes, mismatch/network/quota cleanup, query-cache isolation, offline navigation, cache-first public assets, unavailable first visits, rejected install messages and waiting-worker activation. These are controlled worker/client tests. The enhancement and optional-runtime suites add their own contracts; record final counts only after the final integration run. Optional runtime unit checks and mocked workers do not establish successful real-model inference.

The report suite verified **5/5 tests**: exact deterministic/frozen scale coverage, missingness, flat/tied profiles, deselected-module isolation, and real local PDF export with embedded fonts and hyperlinks. To retain generated fixtures:

```bash
PERSONALITY_PDF_FIXTURES=/private/tmp/personality-report-qa \
  node --test scripts/personality-report.test.mjs
```

The synthetic complete Letter PDF has 11 pages and the partial A4 PDF 10 pages; every page was rendered and visually inspected. Extracted text contained the required scales, seven hyperlinks per file, and no text outside the checked page margins. Persistent QA copies and contact sheets are in `output/pdf/personality-report-qa/`. These are synthetic test responses, not the author’s personal report.

The earlier Rust checkpoint passed 107 unit tests and six integration tests, including two real-browser tests; rerunning after the enhancement integration remains part of the final release gate. The personality Chrome regression follows the article into the library, installs the real scoped worker, verifies clean cache keys, and makes the origin return HTTP 503. All six app routes then reload from offline files, saved answers return, a shared summary remains isolated, and the PDF button creates a valid PDF blob and download anchor from cached assets. Other checks cover the shell’s local asset/DOM contract, allowlisted routes and unknown routes, privacy headers, indexable introduction, encoded article route, exact asset paths and article CTA behavior. Browser UI, offline reload/network, keyboard and responsive checks complement these tests; pure suites alone do not establish all browser behavior, storage eviction behavior, or psychometric validity.

For local operation, `cargo run -p website --features dev` serves the existing Rust app; the repository also provides `just dev` when its watcher/socket tools are installed. Open `/articles/big-personality` or `/personality/prepare`. No respondent backend, model server, or separate JavaScript application build is needed.

## Personal reflection and optional LiteRT-LM

The report workspace offers 24 reviewed experiment cards. It selects up to three using explicit editorial weights for the stated goal, preferred format and available measured facts. The 92-value feature representation is 46 normalized facet/interest/value inputs plus 46 availability flags; its existence does not make the editorial selector a trained model. No trained ranker, calibration dataset, outcome model or benefit evaluation is included. The four original chapter experiments remain distinct from this 24-card set.

Ten local AI actions are implemented as bounded prompts: profile synthesis, follow-up questions, a real work example, personal experiments, visibility planning, values trade-offs, a working-with-me guide, a report question, past-experiment reflection, and reflection review. The prompts distinguish measured facts, stated preferences and unverified examples. The application asks for at most three short sections and accepts a bounded schema of one to four sections with known evidence IDs; text is validated and rendered with `textContent`, never interpreted as HTML, a URL or executable code. The chosen task is a trusted system instruction, while only relevant optional notes enter the prompt as untrusted data. Ambiguous historical facet names receive descriptive input labels. Generated prose containing digits is rejected so numerical scores remain in verified evidence. One bounded correction is allowed after a parsed draft fails validation; cancellation, load failures and timeouts are not retried. These checks reject malformed output and certain unsupported claim phrases; they cannot establish that every generated statement is correct. The reader reviews and may edit the draft before explicitly keeping it. Scientific answers, scoring and norms remain unchanged.

The optional runtime is pinned `@litert-lm/core@0.17.1`, with vendored licenses and a portable WebAssembly build, under `/assets/personality/ai/v1/`. The optional public manifest currently totals approximately 34 MB (about 33 MiB), most of it WASM. The model is the specific web-compatible `gemma-4-E2B-it-web.litertlm` pack: 2,008,432,640 bytes, pinned distributor revision and SHA-256 in `model-manager.mjs`. The browser opens a publisher download link with no referrer; the person imports the resulting local file. The app does not fetch the model from a remote AI endpoint, send a prompt or answer to the publisher, or upload the selected file. All server-served runtime paths are public static files; weights remain outside RustEmbed and Git.

Model import verifies byte count and incrementally hashes bounded slices before committing a separate local Cache Storage entry. Setup and generation expose cancellation; the runtime has explicit load/unload/removal and bounded generation. Capability, storage or model failures leave the ordinary report available. WebGPU support and enough disk space do not guarantee sufficient runtime memory on a particular device. The worker receives a Blob and uses the local LiteRT-LM API. CSP allows same-origin code and the WebAssembly compilation permission within the personality boundary while keeping external connections blocked. No public inference service, credential, Firestore or auth service is required.

Keeping a reflection preserves its actual wording and supporting excerpts in local storage and the PDF. Sharing it is a separate explicit choice through `#e=` or reflection JSON; unused notes remain local. The recipient reads the saved text without rerunning AI. The standard report and questionnaire work without installing the runtime or model.

The earlier [enhancement proposal](litert-enhancement-plan.md) includes training and evaluation ideas that are not established results. The optimized build, 108 Rust unit tests, six integration tests, and real full-model WebGPU inference have passed locally. Enhanced PDF prose was extracted and checked in Letter/A4 exports, and the new pages were visually inspected. The optional runtime README records the final model/prompt smoke results and their limits. Deployment is checked against the exact committed release using `node scripts/personality-live-smoke.mjs --origin=https://engmanager.xyz --expect-local`; the release PR records its result. Community-specific norms, reliability estimates, incremental-validity claims, demonstrated AI benefit and accessibility certification require separate evidence; implementation alone does not establish them. The personal input report and generated `output/` artifacts are intentionally excluded from Git.

## Final local release checks

The final local suite contains 66 JavaScript tests, 108 Rust unit tests and six integration tests, including Chrome filling all 170 answers. The same-answer/different-context, exact `#s`/`#e`, read-only/fork, PDF, offline and request-privacy flows pass. Formatting, Clippy and the optimized release build pass. GitHub CI runs the JavaScript suites and checks generated manifests before Rust and required browser tests.

A real stock-Chrome WebGPU smoke exercised all ten actions through the application generation and validation functions under the exact enforced CSP: ten structured outputs were accepted. Focused follow-ups after context refinements passed for values trade-offs, dated notes and Q&A; Q&A exercised the single correction retry. These are integration observations on one host, not psychometric validation or a supported-device guarantee. Generic or imperfect narratives remain possible and are shown as editable drafts. No model calls are required to read a shared reflection.

## Edge behavior found during deployment

PR #46 was merged and Render automatically deployed commit `34085445b965006c2e817c0f4f51f90ba85e6c0b`. Public browser checks passed for answer persistence, reload, read-only sharing, PDF download and original-draft isolation, with readable desktop/mobile layouts. All 48 optional runtime assets matched their pinned hashes, sizes and MIME types.

Live verification also exposed behavior that local tests cannot reproduce: Cloudflare injected its Web Analytics beacon into browser HTML and rewrote the service worker's `no-cache, max-age=0` to a four-hour browser TTL. The enforced CSP blocked every observed beacon request before any response, and no respondent POST or remote inference occurred. The follow-up adds `no-transform` to assessment HTML, preserving the public article's cache policy and private pages' `no-store`, and adds explicit browser/CDN `no-store` to the worker update route. The deployment checker requires both protections. Cloudflare documents [no-transform as preventing automatic beacon injection](https://developers.cloudflare.com/web-analytics/faq/) and [the precedence of CDN cache-control headers](https://developers.cloudflare.com/cache/concepts/cdn-cache-control/). Production verification remains necessary because explicit edge rules can override origin policies.

These controls do not change Cloudflare's zone-wide Network Error Logging or Speed Brain settings. Infrastructure requests and edge logging remain distinct from application storage: questionnaire answers, private notes and model inputs stay in the browser unless the reader explicitly exports or shares them. Full snapshots use URL fragments; the optional public query summary intentionally exposes its selected scores in the request URL. See [Cloudflare's NEL documentation](https://developers.cloudflare.com/network-error-logging/) for the separate origin-wide reporting policy.
