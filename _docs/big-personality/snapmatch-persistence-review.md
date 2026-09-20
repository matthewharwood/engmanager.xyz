# Snapmatch persistence review for The Big Six-Seven

Inspected 19 September 2026, read-only. This review examined the active application in `/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web`, its shared schemas and root `AGENTS.md`; it did not change that repository or run its tests. The destination is the existing Rust/vanilla-JavaScript blog, not a migration to Snapmatch's React/TanStack/Firebase stack.

## Decision

Borrow Snapmatch's **validated hydration before defaults, one durable local store, and post-commit notifications**. Do not borrow its remote game synchronization. The Big Six-Seven has no remote respondent database, authentication, server lookup, shortener, Firestore, or personal-data API. Its responses and report state live in IndexedDB. A complete share URL contains the selected snapshot itself and is independently decodable without retrieving a record.

Snapmatch explicitly separates these concerns. Its `AGENTS.md` makes Firestore authoritative for shared games but keeps device settings and generated sample progress local ([remote-first policy](/Users/matthewharwood/Documents/GitHub/snapmatch/AGENTS.md:70), [local-only exception](/Users/matthewharwood/Documents/GitHub/snapmatch/AGENTS.md:103)). That policy describes Snapmatch; it is not an instruction to add remote storage to this assessment.

## Evidence and transferable patterns

| Actual source | Observed behavior | Big Six-Seven application |
|---|---|---|
| [Root hydration boundary](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/lib/root-shell.tsx:38) | Root `use(idbHydrationPromise)` resolves before children render. | Await validated local hydration or valid URL decoding before constructing editable UI state. A visible loading state is preferable to briefly rendering defaults and autosaving them over existing answers. No React dependency is needed to copy this ordering. |
| [Local atom adapter](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/lib/atom-with-idb.ts:26) | An uninitialized atom reads the hydrated snapshot before falling back. Writes parse the candidate with its schema. | Maintain an explicit `uninitialized` state; `null` answers and empty arrays are valid data, not evidence hydration failed. Validate each candidate against its pinned instrument. |
| [Settings and progress schemas](/Users/matthewharwood/Documents/GitHub/snapmatch/packages/schemas/src/index.ts:11) | Runtime schemas supply defaults and inferred types. Progress records have `id`, score, round, completed. | Use runtime schemas for drafts, navigation cursor, selected modules, release references and imported payloads. Do not copy the game-shaped schema or its default sound-on setting. The assessment defaults sound off. |
| [Database opening and cumulative migrations](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/db.ts:135) | One cached `openDB` promise; every applicable version migration runs. | One `engmanager.big-personality` database; cumulative storage migrations independent of instrument/scoring versions. Pin and test old records. Never reset the database to repair a migration. |
| [Database lifecycle handlers](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/db.ts:269) | Handles blocked, blocking and terminated connections. | Surface reload/blocked-storage recovery, close connections when required, and preserve memory state and export capability. |
| [Hydration parsing](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/hydration.ts:166), [single hydration promise](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/hydration.ts:272) | Reads durable rows, validates them and creates a resolved snapshot. Invalid rows are treated as recovery evidence rather than silently trusted. | Validate saved responses and their release identity before rendering or scoring. Retain invalid original records for recovery; distinguish missing storage from invalid data. Unknown instrument releases cannot silently become the newest release. |
| [Compare-before-repair](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/hydration.ts:200) | Re-reads the row inside a repair transaction and verifies it still matches the observation before deleting/quarantining it. | A recovery pass must not remove a newer answer written by another tab. Use expected revisions or exact observed-row comparison in the same transaction. |
| [Local progress persistence](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/persist.ts:166) | Parses progress, writes IDB, then publishes invalidation metadata. | Commit answer, skipped status, cursor and active-draft pointer together; notify other tabs only after commit. Receivers re-read validated IDB state. The channel is not the source of truth. |
| [Invalidation schema and publication](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/persist.ts:136) | BroadcastChannel messages have commit/source metadata. | Broadcast only draft ID and revision metadata, not raw answers or full reports. Check revision inside IDB for concurrency correctness. |

Snapmatch's small local schemas use `z.object`, not a strict unknown-key rejection mode. Do not infer strict import behavior from them. Public assessment snapshots must reject unknown keys and invalid/ambiguous encodings; unknown properties are not silently accepted and then discarded. A runtime validator need not be Zod if a smaller reviewed validator meets the same contract and bundle budget.

## Important difference: current local writes are debounced

Snapmatch sets `DEBOUNCE_MS = 150` ([constant](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/persist.ts:60)). Its scheduler clears the previous timer, starts another, and catches write errors by logging them ([scheduler](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/persist.ts:152)). The atom adapter publishes the new in-memory value before calling a `void` writer ([write path](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/lib/atom-with-idb.ts:34)). This is a useful lightweight settings pattern, but it does not itself prove a just-selected response survives an immediate reload.

For the assessment, promptly enqueue a serialized write on every material change. The promise resolves only after `tx.done`; show “Saving…” until the latest revision commits. Commit the response and the cursor that follows it in the same transaction. Back, Continue, report generation, export and link creation await the relevant pending writes. Disable an action briefly while its durable transition commits rather than reporting an unsaved next page as saved. Do not depend on a `beforeunload` handler to finish asynchronous IDB work. Browser termination before commit can still lose the pending mutation; the promise is “saved changes resume,” with visible status and failure recovery, not an impossible guarantee against abrupt process loss.

If IDB fails, offer a clearly marked memory-only session plus a local JSON backup and full snapshot link. A valid incoming self-contained snapshot should still render when IDB is unavailable. Local storage availability must not become a requirement for decoding shared data.

## Game invites are not snapshot links

Snapmatch creates `new URL(\`match/${gameId}\`, env.VITE_SITE_URL)` ([invite URL](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/routes/match/$gameId.tsx:108)). Its remote host describes the flow as “Firestore → Zod → IDB → Jotai” ([invite hydration boundary](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/remote/remote-sync-host.ts:517)). The repository parses the game ID and executes `getDocFromServer(doc(firestore, path))` ([document read](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/remote/snapmatch-firestore-repository.ts:426)). Firebase uses `memoryLocalCache()` ([initialization](/Users/matthewharwood/Documents/GitHub/snapmatch/apps/web/app/state/remote/firebase-client.ts:84)); that prevents a second SDK durable cache, not remote storage itself.

Therefore a Snapmatch invite references mutable, expiring external state. It cannot demonstrate historical reconstruction from the URL alone. The assessment must implement its own self-contained codec. No game ID, random report ID, or local draft ID can substitute for encoded answers and versions.

## Required assessment ingress and refresh behavior

| Entry condition | Authoritative state | Required behavior |
|---|---|---|
| Valid full `#s=` snapshot, with or without an existing local draft | Decoded URL snapshot | Render the fixed imported snapshot read-only. Do not overlay local answers, cursor, module choices or date. Do not autosave over the local draft. Keep the fragment so refresh reconstructs the same snapshot. |
| Full snapshot using `?s=` transport | Unsupported transport | Reject in v1. Raw-answer snapshots are fragment-only; only selected-domain `r` summaries may use the explicit public query option. |
| Invalid, ambiguous or unsupported snapshot | Error state | Reject atomically with a clear explanation. Do not quietly merge it with local state or show a report from defaults. Offer an explicit action to leave the link and resume local work. |
| Optional valid summary `?r=` or `#r=` | Decoded selected-domain summary | Read-only summary, clearly labeled as self-reported and not a complete answer snapshot. It cannot resume a questionnaire or reproduce omitted report sections. |
| No share parameter | Validated active local draft | Await hydration, resolve active draft and newest committed revision, then restore responses, module choices, skipped items, cursor and view before editable controls mount. Only create defaults after confirming that no saved draft exists. |
| “Continue locally” from a full snapshot | New local fork | Validate everything, assign a new local ID, commit fork and active pointer, await completion, then remove the share token and enable editing. Retain the preexisting local draft. If save fails, keep the imported snapshot and show recovery. |

For an ordinary local refresh, the active-draft pointer and the draft's committed cursor must describe the same transaction. A stale default cursor, an unrelated newer report, or a cached UI atom must not override the latest committed draft revision. If the pointer is missing, offer the most recently committed valid draft; never discard other drafts. Cross-tab conflicts require explicit reload or fork, not unchecked last-write-wins updates.

## Complete snapshot content and exactness

The full `s` protocol and the summary `r` protocol serve different purposes. A full snapshot includes all 170 canonical response slots, optional-module selection and order, answered/skipped state, current cursor and view, locale and wording variant, and immutable instrument/content/scoring/template release references. It may represent an incomplete questionnaire or a finished report. Incomplete core scales and optional modules obey their normal scoring completeness rules after decoding.

Each response is packed into three bits: `0` means unanswered; `1…5` are valid in IPIP-NEO-120 and Mini-IP; `1…6` are valid in TwIVI. `7` is always invalid. The 170 slots require 510 bits, or 64 bytes with validated padding. Do not pre-transform Mini-IP's stored responses to 0–4 in the URL: doing so would collide with the unanswered marker. Answered/skipped bitsets must be consistent with these response slots; unselected modules contain neither answers nor skip flags in a snapshot that excludes them. Freeze the mapping of slot indices to source item IDs in the pinned order manifest.

Notes are excluded from the v1 link schema. Its preview discloses that exclusion, so a link is not described as a verbatim copy of the private notes section. Separately approved notes can appear in a local personal JSON/PDF export. Do not include name, employer, email, browser identifier or local draft ID. If a generated report displays a date, preserve that displayed date in the snapshot or omit dates from both renderings; do not replace it with the recipient's current date. Model suggestions must resolve to frozen, reviewed content IDs or be excluded with disclosure; replay must not rerun a nondeterministic model and call the new text identical.

“Verbatim” means identical normalized answers, module state, scores and selected reviewed report text under the same retained releases. It does not promise identical pixels across browsers, fonts or page sizes, nor byte-identical PDF files containing renderer-dependent metadata. The URL contains respondent state; it is not an entire application binary. Public archived release assets must remain available, or already be installed offline. If a required old release is missing, show an unsupported-release state rather than silently reinterpreting the snapshot with new keys or prose.

Base64url and bit packing provide compact transport, not confidentiality or authenticity. Anyone receiving the link can recover its contents. Fragments avoid inclusion in ordinary HTTP requests but remain visible to scripts and to recipients or platforms receiving the whole link. This blog's full-URL RUM and retained soft-navigation listeners remain release blockers; see [architecture research](./architecture-research.md).

## Acceptance evidence required before release

1. Complete several items, change module selection and cursor, wait for “Saved,” reload: all committed state returns before defaults or editable controls appear.
2. Reload while a write is pending: no false saved badge; the last committed state returns, with no claim that an interrupted write was durable. Force a write rejection and verify recovery/export.
3. Copy a partial snapshot and a completed snapshot, clear IDB in a separate browser profile, open each link: logical state and deterministic report match without any respondent lookup.
4. Keep local draft A, open snapshot B, refresh B twice: B is unchanged and A remains intact. Choose Continue locally: a new draft C appears, B's URL is removed only after commit, and A still exists.
5. Decode every valid response, including TwIVI 6; reject core/interest 6, any 7, invalid lengths, nonzero padding, contradictory masks, unknown versions, duplicate query keys and simultaneous `r`/`s` payloads.
6. Change the deployed bank and template: an old snapshot continues using its old retained releases; unavailable or hash-mismatched releases fail clearly.
7. Instrument all fetch, beacon, websocket, navigation and error-logging traffic. No answers, progress, notes or full reports leave the device automatically. Only explicitly selected summary fields may appear in a public `r` query. No Firestore, auth, personal-data API or shortener is present.
8. Test local reload and incoming snapshots with IDB disabled, quota exceeded, two tabs open, offline installed assets and first-visit offline. Do not conflate these conditions or claim offline support before the required public release is installed.

This is source inspection and a proposed contract. It does not claim that Snapmatch's tests were executed or that the production blog already implements the assessment.
