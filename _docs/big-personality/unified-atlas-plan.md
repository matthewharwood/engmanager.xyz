# Unified report atlas: implementation plan

Status: implementation plan for the branch from main `beb12de` (23 September 2026).

## Starting point

Main ships the local-first, versioned v4 assessment, a PDF scores export, and a separate workplace PDF prompt kit. The optional 36-question context bank, 78 tarot placeholders, zodiac calculator, draft type questions, and color formulas are research artifacts only. This branch will integrate the useful parts as a new presentation release while preserving v1–v4 bytes, saved scientific answers, and legacy shared links.

## Product contract

1. One report has a short overview and five deeper chapters: measured traits, motivations (interests and values), editorial color view, optional type exploration, and optional symbols/story. The chapters share one visual language and a persistent report navigation. An empty optional chapter explains how to add it; it never invents a score.
2. The four color channels are deterministic editorial summaries of complete Big Five facets, drawn as overlapping CSS circles with a text legend and numeric table. Every ordering and combination is rendered from the same component. Missing facets yield an unavailable view, not zero.
3. Type is an experimental preference module with its own questions and version. It is never called an official MBTI result. A four-letter code appears only when all four axes are complete and the person requests this view. Famous-person parallels are optional editorial illustrations, never evidence or a validated type match. Each image needs source, license, alt text, and a text fallback.
4. Background questions, name, birthday, and tarot are voluntary. Exact birthday and demographic answers remain separate from the scored state, backup, and share URL. Export review starts with no context fields approved. Identity and symbols never alter trait, type, interest, value, or color scoring.
5. The report kit asks for a five-movement narrative: overture, patterns at work, tensions and conditions, symbolic coda, and compact evidence appendix. Each movement has a tone, evidence rule, and visual cue. Missing optional data removes the corresponding motif. The PDF remains a printable, selectable-text booklet with images only when rights and access permit.

## Implementation sequence

1. Create v5 from v4 and update server route, release generator, offline manifest, and exact-release tests. Lock v4 as a published predecessor.
2. Bring the vetted story bank/core and type/color scoring into same-origin v5 assets. Add the optional local context/editorial module and saved records with draft ownership. Keep the original 170-item state and scoring unchanged.
3. Build the overview, color mark, chapter navigation, tooltips, compact section cards, type exploration, portrait gallery, tarot spread, and print stylesheet. Keyboard, screen-reader, narrow-screen, reduced-motion, and no-image states receive first-class treatments.
4. Update the kit export with separately approved story context, symbols, type/color metadata, image provenance, and the narrative score. Preserve the current evidence packet and comparison protections.
5. Run unit tests for boundary states and output invariants; run the release, Rust, and browser checks; inspect the report at desktop, phone, and print sizes; then open a PR and watch CI to green.

## Editorial and privacy checks

- Cite biography facts and photo provenance. Type associations must say they are unverified editorial analogies; no mental-health, hiring, ability, ethnicity, birthplace, or astrology inference.
- The participant chooses what enters the kit; no optional private input is sent automatically. Remote portrait images are loaded only in the public report if policy allows; a locally bundled, attributed image is preferred for stable printing.
- Report prose can connect measured constructs but must not merge their scales into a composite score or treat symbolic material as evidence.
- On any incomplete assessment, the dashboard displays coverage and only complete measured scales. Shared snapshots still use the published v1 renderer.

## Acceptance criteria

- A complete report has coherent overview, drill-down navigation, color combination graphic, type analogue (when type completed), and voluntary tarot/zodiac views; all print without clipped content.
- A kit contains the approved story fields and a five-movement PDF script, never a full date of birth or unapproved demographics.
- Published releases verify byte-for-byte unchanged. The new v5 manifest includes every asset, works offline except explicitly marked external sources, and CI is green on the PR.
