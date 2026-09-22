# Verification record

22 September 2026. Reference implementation and artifact checks; no production feature activation.

| Check | Result |
| --- | --- |
| Existing questionnaire reference tests | Passed: counts, reverse keys, missingness, original module gates, compact selection, and value centering |
| Original packet regression from earlier session work | All 51 original scale results and values grand mean matched exactly; private answers are not included |
| New background bank | 36 optional choice questions, stable IDs, explicit options and uses, zero score weight |
| Geographic selector | 249 unique country/territory choices plus per-question opt-out and another-place options |
| Birthday logic | Passed HKO-based 2024, 2025, 2026 day-before/day-of Lunar New Year fixtures; invalid dates and future birthdays rejected; Western boundary dates unresolved |
| Consent filtering | Unapproved background fields and full birthday excluded; symbolic feature approval must also match the respondent's selection |
| Response validation | Single/multiple limits, exclusive opt-out/none choices, unknown options, and unselected free text checked |
| Tarot | 78 unique cards; 22 Major Arcana; 14 cards per suit; three different cards per draw; orientations and recorded deck versions validated |
| Random selection | Rejection-sampling boundary tested with a deterministic test RNG; production requires a cryptographic RNG |
| Markdown and asset URLs | Code-fence/HTML-sensitive answer characters escaped; asset URLs require a configured approved HTTPS origin; placeholder hosts rejected |
| Sample report | Five pages rendered and visually inspected for layout, captions, glyphs and images; all pages labeled fictional |
| Personal information | No real participant answers, scores, birthday, or narrative are included in this kit; example records are explicitly synthetic |

Commands: `node base/scoring.test.mjs`; `node src/story-core.test.mjs`; `node src/build-example.mjs`. Node 24.19.0 was used. The sample PDF was built with ReportLab and rendered with Poppler. Card PNGs were rendered from the original SVG placeholders with sharp. These rendering operations do not change the image-generated card-back artwork.

The birthday tests are not an exhaustive validation of all historical dates. No production IndexedDB migration, browser flow, Rust build, release-manifest update, CSP change, remote image fetch, Cloudflare publication, participant research, cultural scale validation, or demonstrated narrative-quality improvement is claimed. The new background prompts are editorial context questions; type-preference questions remain unvalidated research candidates.
