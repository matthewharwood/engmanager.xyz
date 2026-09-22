# Integration with engmanager.xyz

Inspected main at `d12c52ee50e3944b5a4819b2d59f5854b83d296c` on 22 September 2026. This proposal belongs under `_docs/big-personality/story-kit-v2/`. Root `CLAUDE.md` was empty; no `AGENTS.md` appeared in the recursive repository tree.

## Existing contracts

The current UI and portable report workflow use `website/assets/personality/v4/` with frozen scientific modules from v1. The repository README and `report-kit-workflow.md` require published v1-v4 and AI assets to stay byte-identical. The current report is a third-person workplace briefing. The proposed story edition is an additional explicit report mode for personal use; it does not silently add demographics or tarot to a manager-facing export.

The application is local first, with separate IndexedDB notes for report-kit settings, draft ownership, compare-and-swap revisions, a review before export, and no automatic external LLM call. These properties remain necessary for the new context records. The current CSP is same-origin; remote asset loading is not enabled by this research PR.

## Proposed implementation sequence

1. Create a new versioned presentation release after product review; do not patch frozen published files. Keep existing routes and exact shared-link decoding compatible. Register all new public asset paths in the normal release generator and Rust asset allowlist.
2. Add optional background/settings records keyed by assessment draft ID, with their own revisions. Separate field responses, export approval, exact birthday, and selected tarot draw. Keep full birthdays out of ordinary answer backups, share URLs, and report Markdown. Start newly forked drafts with blank context/export settings, just as existing report-kit details do.
3. Add a short onboarding preface and later enrichment chapters. Existing answers continue to use the current scientific scoring code. If a type pilot is activated, store its answers in a separately versioned module and label its output experimental. Background choices never flow into those score functions.
4. Add the birthday symbol calculator and 78-card draw as independently selectable features. Persist a draw when created and reuse it across exports. A redraw creates a new record; the UI shows which draw is included. Do not derive randomness from identity or a birthday.
5. Extend the export preview with per-field approval and a story-edition toggle. Build the context payload with `prepareStoryPacket`, then attach it to the selected existing assessment evidence packet. `packetMarkdown` escapes fence and HTML-sensitive text but an LLM is still not a security boundary. Keep the instruction/data separation and a reviewed report prompt.
6. Add the private story PDF/Markdown flow. Use included local assets first; configure Cloudflare only after the intended origin, privacy/network behavior, manifest, and CSP are decided. The exported packet can carry approved public asset URLs without fetching them inside the live assessment page. Unavailable images have a text fallback.
7. Run the established scoring, share, storage, offline, PDF, and exact-release suites. Add real-browser checks for field approval, deletion cleanup, multi-tab stale writes, redraw persistence, clipboard fallback, reduced motion, keyboard card controls, optional symbols, and network failure. Then generate a new release manifest and verify the Rust routes/build. None of these production integration checks is claimed by the reference-kit tests.

## Record shapes

The proposed storage namespaces are `story-context-v1`, `story-export-settings-v1`, and `story-tarot-draw-v1`. Use the existing per-draft ownership and revision patterns; these names are proposals, not migrations applied in this PR. A background answer is `{status, selected: [optionId], selfDescription?}`. Skipped and unanswered are separate states. Country selections use `country-XX` identifiers from the included catalog.

Export approvals are an explicit list of background IDs plus separately approved symbolic feature IDs. `prepareStoryPacket` starts with an empty approval list and drops unapproved or declined responses. Symbol approval must also match the participant's BG35 selection. An approved nickname is included only through `includeName`. The exact birthday has no standard export field.

## Scope of this PR

This PR preserves the session's research, complete candidate banks, original scoring reference, new context/symbol modules and tests, 78 placeholder card pairs, generated back, report-writing prompt, and fictional visual sample. It adds an index link in the existing research README. It does not change production routes, published assets, score definitions, storage, CSP, release manifests, or deployment settings. This makes the full proposal reviewable without presenting experimental type scores or collecting new sensitive data in the live application before integration review.
