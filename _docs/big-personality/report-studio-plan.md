# Unified report studio: implementation plan

Prepared 22 September 2026, before implementation. Builds on merged PR #51 and main `beb12dec0a132652741d0a2b22ecafef122a7615`.

## Outcome and acceptance

Ship a new versioned report presentation in the existing local-first application. One report combines personality, interests, values, experimental preference/color lenses, optional biographical parallels, and optional symbolic keepsakes. Interactive navigation and printable pages consume the same report model. A versioned five-movement writing score gives the LLM kit a stable order, tone, illustration slots, evidence boundaries, and repeatable output structure. Presentation edits never modify scientific answers.

## Planned sequence

1. Audit the frozen v1-v4 contracts, storage, shared links, offline installation and server shell. Preserve their bytes; add v5 and lock v4 before changing the default presentation.
2. Research a finite catalog with one globally recognizable biographical parallel per each of 16 preference codes. Store short original summaries, precise sources, editorial connection and limitation, photograph author/license/source and local image path. Public behavior is not a verified MBTI result. Use figures from arts, science, sport and enterprise; do not infer politicians' personalities. No similarity percentage, endorsement, superiority or prediction of success.
3. Generate 15 nonempty unordered color-subset SVG images plus a neutral empty state. Four translucent circles overlap lightly in a fixed canonical order. Render identically on screen and print; provide text labels and score tables. Retain the continuous custom-color scores and make any illustrative emphasis rule explicit. Create one ImageGen editorial cover asset; use real sourced photographs for biographies.
4. Implement the report studio: overview, chapter navigation, lens subnavigation, accessible detail dialogs/disclosures, an edition/settings panel, and a bottom action island. Responsive mobile layout; keyboard and reduced-motion support. Show incomplete and withheld results honestly. Keep the ordinary questionnaire and legacy shared reports working.
5. Add independently owned, revisioned local report settings, an optional preference-question pilot, optional name/reader notes, and optional birthday/tarot keepsakes. Keep full birthdays local. Preserve draws and presentation settings across reloads; forks start blank; assessment deletion cleans up owned notes. Export review exposes exactly which optional material is included. Workplace and personal editions share layout; personal keepsakes require explicit inclusion.
6. Build a single canonical presentation/export model. Print CSS expands useful detail into legible pages and omits controls. Ship a synthetic browser-generated PDF demonstrating the actual print layout. Downloadable Markdown includes the complete approved evidence, narrative score, figure provenance, local/public asset references, selected display choices and exact version identities. No remote model call is made. The model is free to narrow prose when data is missing; exact prose repeatability is not promised.
7. Verify scoring regression, all 16 figure entries, all 16 color-image states, incomplete/tied cases, separate storage and stale-write rejection, safe strings, export selection and full-birthday exclusion, UI keyboard/mobile behavior, image failures, offline operation and original shared links. Run existing suites, the release generator and available Rust checks; inspect desktop, mobile and every PDF page.
8. Open a new PR against main with screenshots, sample PDF, commands/results, provenance and any material limitations. Do not merge or deploy.

## Five-movement writing score: A - A′ - B - A″ - C

| Movement | Reader purpose | Voice and evidence | Fixed visual slot |
| --- | --- | --- | --- |
| 1. Portrait (A) | Understand the person at a glance | Warm, candid synthesis; 120-180 words; only supported patterns | Color circles + compact five-domain profile |
| 2. Patterns (A′) | Understand motivation, preference and tradeoffs | Precise, grounded; 220-320 words linking facets, interests and values | Three aligned lens panels and exact score appendix |
| 3. Parallels (B) | See a memorable public-life analogy | Curious, brief; 80-120 words; factual biography plus a clearly editorial bridge | One framed sourced portrait; no claim of shared verified type |
| 4. Working together (A″) | Turn the portrait into a discussion | Practical and balanced; 160-220 words; editable first-person 80-120 words separately | Two-column helpful conditions / possible friction |
| 5. Keepsakes (C) | End with reflection and agency | Optional, imaginative, 80-140 words; symbols are metaphors, never evidence | Exact saved tarot draw and zodiac symbols, when approved |

The five movement IDs, ordering, shared typography, visual slots and evidence tiers stay stable across editions and regeneration. Omitted optional movements retain their IDs in the export contract but do not print empty pages. An appendix preserves numeric scales, uncertainty, sources, image credits and instrument attribution. Reader edits are labeled self-description and do not overwrite score-derived observations.

## Interface and visual direction

Warm paper, dark ink, restrained violet chrome, editorial serif titles, readable local sans-serif body type. Rounded image frames, a quiet generated atmospheric cover, and deterministic SVG charts. A left rail presents chapter position; lens chips narrow the Patterns section; dialogs provide definitions and evidence; a floating bottom island offers customize, print, and kit export. Use native semantic controls and explicit focus management. Do not make essential explanations hover-only. The print layout uses the same section order and figures, with less chrome and expanded score detail.

## Research and interpretation boundaries

The Big Five, interests and values retain their original scales and identities. No overall personality/quality score is created. The type pilot and custom colors are exploratory interpretations, with unresolved axes kept unresolved. A famous person's biography cannot validate the participant's type, capability or employment suitability. Photos are locally packaged with reusable-license evidence; no runtime third-party photo request or AI-generated likeness. Optional astrology and tarot never alter scores or become hiring evidence. No demographic-to-personality inference is introduced.

## Dependency and release strategy

Native ES modules and deterministic SVG; no shader or frontend framework dependency. The new presentation reuses the existing scorer, bank, evidence exporter and assessment store. The same-origin CSP stays intact by packaging photographs and illustration assets locally. A v5 manifest includes the unchanged prior release assets; offline installation remains explicit and integrity checked. All added files must be part of the repository, not transient image-generation paths.

## Implementation scope clarification

Before closing implementation, the existing 36-question optional background bank was promoted into the studio editor, with individual export approvals and revocation on change. This fulfills the earlier session requirement alongside the 48-question preference pilot. The same approved context enters print and the LLM kit, with no demographic-to-score mapping.
