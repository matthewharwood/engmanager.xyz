# Your Story: questionnaire and report kit, version 2

Prepared 22 September 2026. **Research specification, reusable reference code, and placeholder assets.** This kit does not activate a feature in the published application.

The product idea is an optional story layer around the established 170-question assessment. Add rich personal context and a playful ending while keeping the source of each conclusion understandable. A person may enjoy tarot without treating it as evidence, or value it spiritually without granting it authority over a score.

## Start here

- [Background questions](background-questions.md): 36 optional multiple-choice questions, plus optional report name and birthday.
- [Research and product plan](research-and-product-plan.md): cultural research, game flow, data use, zodiac conventions, and narrative design.
- [Report writing prompt](report-prompt.md): the complete brief to send with approved evidence to an LLM.
- [Repository integration plan](integration-plan.md): how this fits the existing versioned, local-first application.
- [Fictional sample PDF](examples/your-story-sample.pdf): visual direction; not a personal assessment.
- [Earlier type/color research](base/research-and-design.md): 218-question pilot, 200-question compact candidate, all 48 new items, weights, and validation plan.

## Complete contents

`background-questionnaire.json` and `countries.json` define the choices and their narrative uses. Every background question has score weight zero. `tarot-deck.json` contains all 78 card records, original reflection prompts, stable IDs, artwork references, and future illustration prompts. `assets/tarot/v1/` contains 78 SVG fronts, 78 PNG fronts, and one image-generated PNG back. Fronts are named placeholders with shared suit motifs, not bespoke illustrations. The sample PDF and contact-sheet preview make that status visible.

`src/story-core.mjs` implements strict background response validation, opt-in export, approximate Western birthday symbols, calendar-based Chinese zodiac, cryptographically random tarot draws without replacement, persisted-draw validation, approved asset URLs, and an escaped Markdown packet. It does not score a person from demographics or symbols, and does not upload anything. The existing assessment packet is supplied separately to `packetMarkdown` and retains its own export controls; a caller must not pass an unreviewed private draft.

`src/story-core.test.mjs` verifies actual date boundaries, exclusive choices, consent filtering, missingness, draw integrity, and hostile text escaping. `src/build-example.mjs` produces a synthetic packet using the included reference scoring code. The latter is documentation/example code, not a replacement for the site's frozen scientific modules.

## Run the checks

Requires a modern Node runtime with Web Crypto and full ICU Chinese-calendar support (verified here with Node 24.19.0).

```bash
node base/scoring.test.mjs
node src/story-core.test.mjs
node src/build-example.mjs
```

If Chinese-calendar support is missing, the reference implementation returns explicit unavailability rather than a potentially wrong animal. Before production, pin a reviewed calendar dataset or runtime version and expand date fixtures for the full supported birth-year range. The current tests are boundary checks, not an exhaustive calendar certification.

## Questionnaire burden

The optional background module adds 36 choice questions and two input fields when taken in full. Against the 218-question type pilot this means **254 choice items plus name and birthday**; against the compact 200 form, **236 choice items plus name and birthday**. Do not require everyone to complete all of them. Offer a short preface, then optional chapters or “enrich my story” after results. Skipping a question or a whole chapter must preserve access to the report and game features.

## Cloudflare status

Assets and stable paths are ready to upload. `asset-config.example.json` deliberately has no active domain. Nothing has been uploaded to Cloudflare. A production app needs a configured asset origin, manifest verification, and explicit network behavior consistent with the existing same-origin CSP. The private PDF packet should carry derived symbols and only approved context, never a full birthday or demographics in a public URL.

## Readiness

The questions are editorial context prompts, not a validated measure of cultural tightness. The type questions and color formulas remain experimental as documented in the earlier research. The sample report is fictional. App integration, storage migrations, release generation, production CSP/network checks, and participant research remain implementation/release work; see the integration plan.
