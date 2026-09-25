# A calmer preparation and questionnaire flow

Scope: the 18 preparation/questionnaire refinements requested on 2026-09-24,
using the supplied screenshots as visual evidence.

## Decisions

1. Reserve the clear-answer control and feedback row in each question. Empty
   questions show a disabled clear action; choosing or clearing never inserts
   another row.
2. Put age ranges in one native select inside a full-width control card. Keep
   the sequence chronological and leave it unanswered until selected.
3. Keep unordered gender choices as checkboxes in the existing responsive grid.
4. Separate country search from its options: a padded, bounded results area
   above the filter, with selected countries kept visible. Disable address
   autocomplete on the filter. Browser-owned autofill cannot be layered with
   page CSS; keeping its usual popup below the field separates the two UIs.
5. Use consistent readable input/placeholder sizing, short placeholders, visible
   labels, and wrapping helper text. Give textareas room for their placeholder.
6. Pad scrolling option areas so their first/last focus rings fit; prevent
   nested input outlines from colliding with the choice outline.
7. Add a compact multiple-selection badge and selection-limit guidance.
8. Separate question headings from divider rules; legends no longer straddle a
   top border that touches their text.
9. Show answered/total counts for the preparation page, its sections, and each
   scored questionnaire page. Retain the total scored-assessment progress.
10. Open all question-bearing preparation accordions by default. Everything
    optional remains optional.
11. Keep a writing area reserved for self-description. Selecting the option
    enables the editor without moving the next question.
12. Use a textarea and a live 0–255 counter; enforce the same limit in storage
    validation and report export. A self-description is complete when it has
    actual text.
13. Use a labelled three-stop slider for report style, preserving the existing
    three semantic answers. An untouched thumb is not an answer. No arbitrary
    second axis is added to questions that have no meaningful second dimension.
14. Clarify the experimental preference item about private reflection: it asks
    about sorting an idea before sharing conclusions, separate from enjoying
    brainstorming aloud. The existing opening items already cover the latter,
    so no extra scored item or weight is introduced.
15. Show only the birthday field in preparation. Draw three unique random cards
    silently once, preserve them across refreshes, and reveal the symbolic
    material in the report.
16. Add a small next-unanswered button that resumes after the furthest completed
    question, returning to earlier gaps when needed. Open collapsed ancestors
    and move keyboard focus with the jump.
17. Put a scroll-to-top circle beside it after a useful scroll threshold; keep
    the controls above the questionnaire's sticky action row.
18. Replace letter-pair titles with readable chapter names and short descriptions.

## Release and saved answers

Published v1–v6 and AI assets remain immutable. A v7 presentation uses the frozen
v1 scored instruments and exact-share decoder. Public artwork is reused from v6.
The shell, offline worker, release generator, and manifest drift check move to v7.

Story records move to a separate `story-atlas-v2` note so a 255-character answer
cannot make an old v6 reader reject its original record. Migration reads and
copies the legacy story without modifying it. All background answers, birthday,
draw, and unaffected preference answers remain. The clarified pilot item gets a
new ID; an existing answer to its old wording is left in the legacy record and
the revised question asks for a fresh answer with an explanatory notice.

## Completion evidence

- Implemented all 18 decisions in the v7 preparation and questionnaire views.
- Manual browser review at desktop, 390px, and 320px checked country search,
  placeholder wrapping, self-description geometry and completion, slider labels,
  next-unanswered focus, and scroll-to-top. The smallest slider labels have no
  horizontal overflow. Country results remain above the focused search field
  and below the sticky progress bar when the viewport has room for both.
- All 164 JavaScript tests pass, including release digests, read-only legacy
  migration, independent revisions, the revised item identity, and 255-character
  persistence/export validation.
- Formatting, Clippy with warnings denied, JavaScript syntax, and published
  release byte verification pass.
- All 150 local HTTP smoke checks pass for route metadata, privacy headers,
  scoped service-worker responses, and the release's public asset hashes.
- The real Chrome personality regression passes, including stable answer/clear
  geometry, exclusive checkbox toggles, 255-character restoration, unclipped
  keyboard focus, progress/navigation at mobile widths, hidden draw persistence,
  scored answers, read-only shares, PDF/kit downloads, privacy, and offline use.
  Its fixture now reports script errors and bounded wait diagnostics immediately.
