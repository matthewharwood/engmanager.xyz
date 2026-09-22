# Unified questionnaire extension kit

Version: `unified-questionnaire-candidate-2026-09-22-v1`

Start with `research-and-design.md`. It contains the findings, recommendation, exact additional questions, reuse mappings, source links, and validation plan.

This is a reusable **research instrument specification**, with no participant answers. It preserves the supplied 170-item questionnaire and adds original, unvalidated preference statements. It does not generate official MBTI, Insights Discovery, DiSC, True Colors, or Color Code results.

## Forms

| Form | Existing items | New items | Type model |
| --- | ---: | ---: | --- |
| `baseline170` | 170 | 0 | No complete type estimate |
| `pilot218` | 170 | 48 | `direct48` by default; also permits comparison with `hybrid48` |
| `compact200` | 170 | 30 | Select `hybrid48` explicitly |

The compact model reuses 18 existing answers. The original color view uses 32 existing personality items and adds no questions. The optional interpersonal measure is a separate proposal, not part of these forms or the reference scorer.

## Files

- `unified-questionnaire-bank.json`: complete item bank, instructions, response options, presentation orders, model definitions, and original provenance.
- `question-weight-map.json`: every item's original scoring role and explicit experimental type/color memberships. Empty memberships mean zero weight in that model.
- `additional-questions.md`: all 48 new statements, keys, and compact inclusion flags.
- `scoring.mjs`: dependency-free reference scorer.
- `scoring.test.mjs`: synthetic checks for scoring behavior; no respondent data.
- `optional-ipip-ipc.json`: optional public-domain interpersonal measure, including the four deduplication candidates and administration caveat.
- `sources.json`: 27 source records.
- `manifest.json`: SHA-256 checksums of kit contents.

## Use in Node

Run this from the extracted kit directory in an ES module:

```js
import fs from 'node:fs';
import { scoreQuestionnaire, unansweredTemplate } from './scoring.mjs';

const bank = JSON.parse(fs.readFileSync('./unified-questionnaire-bank.json', 'utf8'));
const answers = unansweredTemplate(bank, 'pilot218');

// Populate only with actual respondent answers. For example:
// answers[itemId] = { status: 'answered', answer: rawInteger };
// answers[itemId] = { status: 'skipped', answer: null };

const pilotResult = scoreQuestionnaire(bank, answers);
// When administering compact200 instead:
// const compactResult = scoreQuestionnaire(bank, answers, { typeModel: 'hybrid48' });
```

The scorer can also receive an object of item IDs to raw integer answers. It accepts null or absent responses as unanswered. It rejects unknown IDs, invalid statuses, and out-of-range answers. It makes no network requests and has no package dependencies. In a browser, load the bank as JSON and import `scoring.mjs` normally.

Use `bank.forms[form].itemIds` for presentation order. It preserves the original 170 and interleaves the added axes. Look up item definitions by ID; do not assume their editorial array order equals presentation order. Keep the module instructions and response labels, including the six-point values scale. Persist the actual displayed order and the bank/scoring versions with each administration. The retained TwIVI pronoun variant is questionnaire wording, not a respondent identity field.

## Interpretation and missingness

Type means use a 1–5 scale with positive poles E, N, F, and J. Initial weights are equal, provisional content hypotheses. Learned coefficients are null. The default output contains no four-letter type or confidence probability.

For a clearly labeled research preview only, `{ allowHeuristicLetters: true }` enables the documented arbitrary 2.75–3.25 unresolved band. These letters are not official or calibrated results.

Each incomplete personality facet/domain, type axis, or color composite is withheld. Interests require all 30 original responses, and centered values require all 20 original responses. No missing answer is replaced by a midpoint. An incomplete direct model can still return a complete axis; consumers must inspect coverage rather than treat partial output as a complete questionnaire.

Color scores are original facet composites, with component facets exposed. Their optional 0–100 display is a linear scale position, not a percentile or percentage of identity. The colors do not sum to 100.

## Verification

```bash
node scoring.test.mjs
```

The supplied tests check response bounds, reverse keys, endpoint direction, missingness, compact selection, original module completion rules, and exact value centering. A separate regression check during preparation reproduced all 51 supplied original scale results and the values grand mean exactly; the private responses used for that check are not included.

Software checks establish implementation behavior. Respondent studies must establish reliability, dimensionality, fairness, and agreement with any intended external assessment. The report provides that study plan.
