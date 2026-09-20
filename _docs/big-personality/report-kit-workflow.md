# One-person narrative report kit

The report now leads with a portable writing workflow: download one Markdown file, attach it to a fresh conversation in an LLM chosen by the reader, and ask it to follow the enclosed brief. The alternative is to copy and paste the entire file. The app does not upload a packet or initiate an external model request.

The brief requests an integrated narrative, a candid first-person script the reader can revise, and a standalone HTML version. The HTML specification uses inline CSS and system fonts, semantic headings, accessible numeric tables, native disclosure sections, and print styles; it requests no JavaScript, remote assets, forms, frames, or network requests. These are instructions to the external model, not a guarantee about its output. Generated HTML is not imported or executed by this application.

## Evidence and interpretation

The single file contains all **selected** questions with their exact displayed wording, original response values and labels, reverse keys or interest recoding, and explicit skipped/unanswered states. It includes the five Big Five domain results, thirty facets, six interests when selected, and ten raw and centered values when selected, with definitions, coverage, score semantics, and sources. Missing scores stay withheld. No percentile, norm, capability, hiring-fit score, or additional validated factor is created.

The prompt asks the model to connect facets rather than merely paraphrase headline traits, distinguish evidence from hypotheses, examine counterexamples, and offer possible work conditions and reversible experiments for the reader to discuss. It requests a thoughtful voice informed by psychology without impersonating a psychologist or suggesting professional assessment. The first-person script is an editable draft, not an invented biography. A fresh conversation and explicit one-person scope reduce accidental reuse of another person's information; no Matthew/Marcus example is copied into the packet.

Optional name and context are entered specifically for this export. A kept local reflection is excluded by default; an explicit checkbox includes the previewed prose as unverified prior writing, not as an additional source of evidence. Unused local AI notes and their excerpts are excluded. The packet's JSON is inert text with Markdown fence and HTML-sensitive characters escaped. No participant value becomes HTML, an executable path, or a filename.

An optional secondary comparison prompt is available behind a disclosure and at the end of the file. It remains inactive for the single-person task. It asks for two separately supplied packets with both participants' agreement, keeps evidence and score tables distinct, and requests a collaboration discussion guide and HTML. There is no multi-person storage, compatibility score, or automatic merging UI in this release.

## Interface and persistence

The main report presents one primary **Download report kit (.md)** action and a copy alternative, followed by concise instructions and the scored report. Full prompt/evidence preview is available before export. Score PDFs and existing sharing remain accessible; charts, detailed facets, methods, experiments, backups, and optional local AI controls use progressive disclosure.

Optional name/context are saved as a separate `report-kit-settings-v1` record in the existing IndexedDB `notes` store. Records have a `draftId` and their own compare-and-swap revision, so they cannot rewrite assessment scores or silently replace another tab's edits. Existing assessment deletion removes these owned notes. Name/context are not included in ordinary answer backups, snapshot links, summary links, or reflection JSON. A fork starts with blank export details. Storage failures remain visible and still allow downloading the current fields.

## Published-release compatibility

Every published `personality/v1/` and `personality/ai/v1/` file stays byte-identical. The revised presentation lives in `personality/v2/` and imports the frozen scientific scoring, storage, codecs, definitions, and PDF modules. Legacy shared links continue through the original app. The new UI's ordinary saved drafts use the same database and exact snapshot protocol.

The v2 service worker installs the current presentation plus the public assets required for legacy reports. It accepts the recognized v1 and v2 installer identities, verifies the selected manifest, and preserves earlier caches. No answer-bearing URL is used as a cache key. Tests pin the original asset digests so a presentation revision cannot silently invalidate published links.

## Verification

The kit suite checks all selected item wording and answer/key mappings, independent complete-score fixtures, every individual missing-item case, omitted-profile isolation, source versions, malicious delimiter-like text, optional reflection consent, and non-mutation. IndexedDB tests cover reopen, per-assessment isolation, stale writes, invalid records, and deletion cleanup. Real Chrome tests exercise the actual Markdown download, clipboard-denial fallback, persisted optional details, legacy exact sharing, PDF, and kit creation while the origin is unavailable. Desktop/mobile visual checks cover the streamlined presentation separately from numeric correctness.

The same prompts can produce different narratives across models and runs. This implementation makes the evidence portable and inspectable; it does not establish the validity or quality of a particular external model's interpretation.
