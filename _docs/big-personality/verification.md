# Verification record

Research package checked 19 September 2026. This document records the original research and preview checks. The subsequent complete application and its verification are documented in [production-implementation.md](production-implementation.md), including real IndexedDB, serialization, PDF, offline, and Chrome tests. No public deployment has been performed.

## Question inventory

`python3 _docs/big-personality/scripts/verify_banks.py` passes:

- 120 unique core IDs in published administration order.
- Five domains with 24 items each; 30 facets with four items each.
- 65 positive and 55 reverse-keyed items; boolean reverse flags agree with keys.
- Facet membership agrees with the item definitions.
- All question strings occur identically in the readable question-bank documents.
- Artificial minimum, midpoint and maximum fixtures produce 1, 3 and 5; a missing first answer withholds N and N1 only.
- 30 interest items, five per RIASEC scale; 20 TwIVI portraits, two per value, for 170 scored items in total. The 24 original prompts are a separate unscored appendix.
- Four delivered Mini-IP fixtures produce the expected 0–20 score units, including the single-item perturbation fixture.
- TwIVI source pair mapping, six-option anchors, no reversals, raw 1–6 means, respondent-mean centering, flat profiles, extreme relative priorities, and all-20 completion fixtures.

The research pass checked wording/key provenance against official IPIP material and Johnson's published numbering, the interest bank against the official Mini-IP appendix, and TwIVI against its official author-hosted administration document. Source TwIVI text and authorized pronoun variants are preserved separately. Item 58's official-key/paper discrepancy is explicitly versioned. Final deployment needs a second exact administration/license audit, including the complete O*NET instructions; it is not certified by this artifact check script.

## Research and specification consistency

Independent passes reviewed the main requirements against the core psychometrics, extension research and repository architecture. Reconciled Mini-IP zero-based scoring, all-30 completeness, the query-sharing privacy exception, midpoint wording, facet-specific inference, database/store names, URL schema scope, and common performance budgets. Following the naming update, replaced the exploratory seventh module with the established TwIVI measure and propagated its dedicated six-option response format, scoring and scientific limits through the package. Statistical independence, unsupported percentiles, diagnostic claims and deterministic job assignments are explicitly excluded.

## Interactive preview

Opened in the Codex browser and exercised the six-step path, native radio selection, review screen, report charts, share-selection updates and the new local persistence path. Desktop and narrow mobile layouts were checked; a narrow-width chart overflow was fixed. The controller passes Node's syntax check, and six pure state-codec tests pass (exact round trip, skipped/unanswered distinction, versions/unknown fields, response bounds, duplicate dimensions/oversize and canonical encoding).

Browser checks verified:

- A committed example answer and Respond step survive refresh.
- A copied snapshot opens the captured answer and step read-only even when another local draft has a different answer and position.
- Refresh keeps that snapshot; returning to the ordinary view preserves the previous local answer.
- Same-document fragment navigation loads the snapshot instead of retaining editable local state.
- “Continue as a local copy” commits a new local record and removes the snapshot fragment before enabling edits.
- A skipped answer remains visibly skipped after refresh.
- Two tabs editing one draft produce a visible conflict instead of a silent overwrite.

An independent code review found and resolved startup writes on restored drafts, same-document link handling, storage-dependent snapshot rendering, premature fork editing and omitted restored-skip feedback. No JavaScript errors were observed during the successful browser checks. Source inspection confirms the preview uses locally vendored `idb`, local media and no remote scripts, analytics or respondent API. Storage-open failures have a bounded fallback; forced quota/eviction/blocked-upgrade browser tests remain production release work.

The example question uses exact IPIP item 2 wording. Report values are synthetic and unrelated to that answer. The preview's `#p=` codec stores only its example answer, choices and step; it is deliberately separate from the production 170-item `#s=` protocol. The preview does not administer the complete assessment or produce a personalized report. No media autoplays. This is not a WCAG conformance audit or a production network audit.

## Custom chart follow-up

The report preview now uses original local SVG/CSS chart cards inspired by the shadcn area gallery. Verified that the complete 120-item synthetic fixture respects source IDs and reverse keys and regenerates the existing domain means and displayed bin counts. RIASEC ties and TwIVI zero-sum centering are preserved. Chart code received independent scale/semantics review.

Browser checks covered switching personality traits, Area/Bars modes, selecting response bins, arrow-key navigation, interest and value detail selection, and desktop/mobile layouts. The 375 CSS-pixel viewport had no document overflow. No JavaScript errors were observed. Fixed trait-label wrapping, axis-end alignment, a cramped mobile summary, and narrow-plot tooltip geometry. Chart controls are temporary presentation state; they do not change persisted answers or the preview snapshot schema. No new network or storage dependency was added. A full screen-reader and print-output audit remains future release work.

## Snapmatch and exact-state design

Snapmatch was inspected read-only, including its local settings/progress hydration and remote Firestore invite flow. No Snapmatch files were changed and its tests were not run. The source review records exact paths and adoption/exclusion decisions. The production specification now defines a full fragment snapshot distinct from the small score-summary protocol, including immutable versions, original response packing, skipped masks, cursor, read-only ingress and explicit local fork. Packing arithmetic was independently checked: 170 three-bit values need 64 bytes; each 170-bit mask needs 22 bytes, with padding validated. The full production codec remains a specified implementation task.

## Media

Both generated illustrations were visually inspected. Their 1536×1024 PNG sources are saved unchanged, with the exact prompts. ElevenLabs produced playable-format MP3 streams: 44.1 kHz, stereo, 128 kbps. Probed durations are 0.60 seconds and 1.48 seconds. File hashes, sizes and stream metadata are in `assets/asset-manifest.json`.

The cues are candidate assets requiring a human listening pass at final playback gain. No claim is made that automated stream inspection establishes subjective sound quality. Audio controls in the preview allow auditioning. No participant information was used in media generation.

## Engineering-document PDF

The final v0.3 PDF has 16 Letter-sized pages, including a cover, linked contents, all requirements, the Snapmatch-derived persistence and exact-state snapshot specifications, and a vector architecture diagram. Verification checked all 259 source paragraph/table-cell entries against extracted PDF text. It contains 16 bookmarks and 28 clickable links (nine public HTTPS citations and 19 companion-document links). All 16 rendered pages were visually reviewed, with additional full-page inspection of the snapshot specification and acceptance matrix. No clipped content, off-page text, or exposed Markdown/Mermaid was found. The PDF is text-based but not tagged PDF/UA; the source Markdown remains available.

The PDF reflects engineering-source SHA-256 `e6c9de2372d3c84aca76b68681bbcf4b4373ba9ddd4123944d0c17252f242f95`. It is the engineering document, not an exported participant report.

## Deliberately not completed

- Production scoring/UI/IDB implementation, offline installation and deployment.
- Production network privacy, CSP, migration, cross-tab, eviction or share-decoder tests.
- Personalized report PDF implementation and a full screen-reader/keyboard audit.
- A LiteRT model compatibility benchmark or proof of benefit.
- Participant recruitment, psychometric validation, norm calibration or translation validation.
- Legal certification or approval of a future adapted instrument.

These are specified release stages, not claimed results. The supplied personal report remains unchanged.
