# Personality form UX and accessibility audit — v6

## Why this release exists

PR #53 changed the contents of `/assets/personality/v5/` after that URL had been served with `Cache-Control: public, max-age=31536000, immutable`. A returning browser could retain the earlier module graph, and an installed v5 offline worker could serve its earlier complete cache. The fresh HTML already contained PR #53, and the live server returned the new `app.mjs`; clearing browser cache made the questions appear. v6 gives every changed module, stylesheet, data file, and image a new release path. The v5 tree is retained for offline compatibility. A fresh no-store HTML navigation points to v6 without clearing local assessment answers.

The byte-for-byte release lock now covers both v5 and v6, and CI verifies it before building. Future changes must use a new release directory. Editing files under a locked `vN` path fails CI and would recreate the original bug even if the server had fresh bytes.

## Audit findings and changes

| Area | Finding | v6 response |
| --- | --- | --- |
| Choice density | Two columns filled the full 1,080px panel, placing related answers far apart. | Choices are capped at a 720px reading width, grouped in compact 44px rows, and stacked in one column below 520px. |
| Repeated decisions | Every answer had Skip, Clear, and Include in kit controls; symbols each had two more checkboxes. | Blank means unanswered; filled answers enter the downloaded kit. Clear appears only after an answer exists. Date yields both zodiac motifs; the three-card spread is drawn once and can be redrawn. No per-field export toggles remain. |
| Scored path | Interests and values could be unchecked, and the values portraits added a separate pronoun dropdown. | The active path uses all 170 scored questions. Neutral wording is the initial default; a self-described BG02 answer can guide the AI report. Existing scored responses and their original release identity are preserved. |
| Scored-item controls | Every scored question also offered a Skip button although Next already allowed an unanswered item. | The redundant button is gone. Blank items remain available to revisit; incomplete scales remain unscored. |
| Long country lists | Hundreds of options sat in a 300px scrolling grid. | A labeled search exposes country matches after two characters. Non-country alternatives and any saved choice stay visible. Only this list uses an internal scroll region. |
| Preference scale | Forty-eight items repeated five bare numbers with no clear endpoint meaning. | Each axis states the 1–5 anchors. Every radio has its full verbal meaning in its accessible name and sits in a compact five-column row. |
| Tarot layout | The spread dominated the preface and three images were tiny on mobile. | Card previews have a restrained height on desktop and a horizontal, labeled, scrollable group on mobile. The report retains the full cards. |
| Export expectations | The kit UI implied fields were excluded unless approved. | The page explains that entered context and kept reflection go into the downloaded file, that blank fields stay out, and that attaching the file to an outside AI provider sends its contents there. Raw birthday stays out of the kit. |
| Error location | Reaching a multiple-selection limit reported an error at the bottom of the entire studio. | The limit message is now adjacent to that question in a status region. |

## Accessibility review

- The 35 background questions and 48 preference items use fieldsets and legends. Controls have an associated label or accessible name. Native details/summary elements remain keyboard operable, and the form has no duplicate IDs.
- Option cards, section links, and the type scale use at least 44px targets. Keyboard focus has a visible 3px outline; checked inputs remain visible so color alone is not the selected-state cue.
- The main form uses natural DOM order on desktop and mobile. At 390px and 320px, choices stack without horizontal page overflow. The tarot group scrolls horizontally within its own labeled area.
- Text color checks against the actual light surfaces: primary blue `#245a81` on `#f8fbfc` is 7.08:1; supporting text `#52616b` on `#fbfcfc` is 6.23:1; focus blue `#367fab` on white is 4.39:1. These exceed the relevant 4.5:1 body-text or 3:1 non-text thresholds.
- Saving, errors, and selection-limit feedback use status regions. Reduced-motion styling is inherited from the existing assessment stylesheet. The scored questionnaire and print report retain their established focus and print rules.

## Verification

The real-browser test opens the preface, saves and restores context, enters a birthday, checks automatic tarot and kit contents, verifies all 170 scored items, installs and uses the v6 offline release, and exercises 1,200px, 390px, and 320px layouts. It asserts fieldsets, labels, unique IDs, target size, reading order, and absence of horizontal page overflow. The Node suite checks exact published-release hashes, report-kit boundaries, scoring compatibility, and complete v6 assets. This is an automated DOM and layout audit; a manual VoiceOver/TalkBack pass remains useful before claiming full assistive-technology certification.
