# One questionnaire, several models

Research and implementation proposal · 22 September 2026

## Recommendation

Build one answer bank with separately versioned scoring models. Keep the existing 170 questions and their published scoring intact. Add an original 48-question type-preference candidate pool for a **218-question development pilot**, then test a **200-question compact candidate** that replaces 18 of those new questions with answers already collected. Start with an explicitly original four-color view of existing facets; this requires no additional questions.

The artifact includes exact question wording, original and new keys, item-level reuse mappings, scoring code, missing-data behavior, and a validation plan. It is a concrete candidate instrument, not a claim that 48 questions or these weights are already the best or most reliable. Reliability must be established with respondents, and accuracy must be defined against a particular target measure. No individual personality interpretation is part of this report.

If the requirement is **official MBTI or official branded color results**, use the corresponding authorized instrument and scoring service. The research below does not identify a universal, validated conversion from these 170 answers into every commercial test. Custom estimates and official results should have different identifiers and names.

## What the research establishes

| Option | Evidence relevant to the project | Consequence for the design |
| --- | --- | --- |
| Official MBTI Global Step I | The publisher lists 92 items and reports scale test-retest correlations of .81–.86 over 6–15 weeks. These are continuous-scale correlations, not the percentage receiving an identical four-letter type. [S06–S07] | The strongest route to an official score is administering that instrument. Its reliability does not transfer to an imitation. |
| Big Five-to-type crosswalk | The publisher summarizes seven studies/samples, total N=2,243: corresponding correlation magnitudes are .79 for E/I, .65 for S/N, .42 for T/F, and .53 for J/P. These estimates were corrected for unreliability using manual coefficients and concern older MBTI and NEO forms, not this question bank. Earlier primary work found dimensional overlap without support for distinct categories. [S03–S04] | These adjusted group correlations suggest candidate predictors; they are not observed prediction accuracy and supply no item coefficients, thresholds, or individual probabilities. T/F especially needs direct coverage. |
| Open Jungian Type Scales | The current OJTS page describes 48 items. Its development selected items against confident self-identified types, rather than uniformly verified official administrations. The development page and current test post CC BY-NC-SA 4.0. [S09–S10] | Useful comparator and design history; not a commercially unrestricted bank or proof of official-MBTI equivalence. Older OEJTS files and newer OJTS forms must not be mixed. |
| 16Personalities/NERIS | The provider explicitly says it reworks Big Five dimensions and does not incorporate Jungian cognitive-function priorities. [S11] | Four familiar letters can represent materially different constructs. Reproducing this provider's labels is not reproducing MBTI. |
| Original preference module | The enclosed wording was drafted for this project. It has no observed reliability, factor structure, criterion agreement, or norms. | Use as a research form. Equal weights are a transparent starting point, not evidence of equivalence. |
| Public-domain IPIP-IPC | Markey and Markey's 32-item interpersonal measure has published initial validation across three studies. [S20–S22] | Optional established measure of interpersonal patterns; it remains distinct from commercial DISC and color systems. |

These sources support a disciplined development route, not a scientific ranking of every available personality product. Provider technical reports are identified as provider evidence. Self-rated accuracy, satisfaction percentages, internal consistency, retest stability, and agreement with another instrument are different quantities.

## There are several different color models

| Model | Its categories or focus | What could be supported here |
| --- | --- | --- |
| Insights Discovery | Red, Yellow, Green, Blue; a Jungian behavioral-preference framework. [S12–S13] | Either integrate the authorized evaluator or validate an explicitly separate predictor against its actual results. A color quadrant inferred from two type axes does not reproduce its evaluator. |
| True Colors | Orange: action; Gold: organization; Green: analysis; Blue: relationships. [S14] | Requires its own target definitions. Its Blue does not mean Insights' Blue. |
| Everything DiSC | Dominance, influence, steadiness, conscientiousness, with an eight-scale circumplex in its technical description. [S17] | A DISC-colored graphic is not a standardized test. Everything DiSC evidence belongs to that instrument and version. |
| Color Code | A provider theory organized around power, intimacy, peace, and fun motives. [S18–S19] | Existing values may be relevant research predictors, but TwIVI values are not measurements of an innate, fixed core motive. No dependable crosswalk was located. |
| Original color facet view | Four named summaries of selected existing personality facets; defined below. | Fully specified now, with no extra respondent burden. This is an editorial view of existing answers, not an official result from any row above. |

Insights' factsheet describes a 25-frame evaluator containing 100 word pairs. It reports alpha values of .915–.930 in N=33,435 and overall color retest correlations of .83–.87 in N=6,250. This is evidence for that administered evaluator, not an accuracy estimate for a new color mapping. [S12]

Everything DiSC's provider table reports two-week retest correlations of .85–.88 in N=599 and alpha values of .79–.90. Its web page presents inconsistent sample-size text across duplicated alpha tables, so this report does not treat that alpha sample count as settled. [S17]

True Colors describes its format as ipsative: respondents choose or rank alternatives, creating dependent scores. The provider-hosted 2021 review examines the pattern of inter-color correlations. Negative relationships in a fixed-sum system alone cannot establish four independent personality dimensions or prove equivalence to a freely rated Likert questionnaire. This is a methodological limitation of using such results as a crosswalk target, not a claim that the product has no usefulness. [S15–S16]

My recommendation is to ship one clearly named original color view if the desired benefit is readable communication. If matching a specific commercial assessment is central to the product, select that assessment before fitting any color weights. Do not let the same output field mean different things depending on which familiar brand the reader assumes.

## Audit of the existing 170 questions

The supplied question bank contains **120 IPIP-NEO-120 personality items, 30 O*NET Mini Interest Profiler activities, and 20 TwIVI value portraits**. The last two are interests and values, not extra Big Five personality scales. Preserve their instructions, answer scales, completeness gates, and attribution.

| Target | Existing useful content | Missing or easily confused content |
| --- | --- | --- |
| E/I | Friendliness and Gregariousness | Preferred outward versus private processing; social skill, anxiety, and social opportunity are possible confounds. |
| S/N | Imagination and interest in theoretical discussion | Attention to concrete examples, observed details, patterns, and meaning. Artistic taste and self-rated abstract ability are not sufficient. |
| T/F | Sympathy and Altruism provide related context | What a person prioritizes when deciding. Anger, manipulation, emotional distress, and agreeableness are not direct T/F scores. |
| J/P | Orderliness supplies a narrow structure proxy | Preference for closure, open options, and adaptability. Tidiness, ambition, procrastination, and rashness are not interchangeable with J/P. |
| Color summaries | Assertiveness, Achievement-Striving, Friendliness, Gregariousness, Altruism, Sympathy, Orderliness, Cautiousness | Brand-specific score definitions remain missing unless that brand is separately measured. |

The initial type models assign **zero weight to all 30 interest answers and all 20 value answers**. They can remain separate explanatory context. Reweighting their raw responses into personality would change the meaning of their scales and invite occupational and cultural confounds. Existing political items, negative mood, anger, impulse-related items, and self-rated cognitive ability also have zero weight in the proposed type seed models.

## The two questionnaire forms

| Module | Pilot | Compact candidate |
| --- | ---: | ---: |
| Existing personality | 120 | 120 |
| Existing interests | 30 | 30 |
| Existing values | 20 | 20 |
| New type-preference statements | 48 | 30 |
| Extra questions for original color view | 0 | 0 |
| **Unique questions asked** | **218** | **200** |

The pilot's `direct48` model uses 12 newly drafted questions per type axis, six aimed toward each pole. Twelve is a practical initial item-pool choice with room for later rejection; it is not an evidence-based minimum or optimum. Do not promise that adding 48 questions yields a specified reliability.

The compact form's `hybrid48` model uses 48 inputs but asks only 30 new questions. It reuses 18 current answers. On the 218-question pilot, both models can be calculated for comparison. Agreement between them is not independent validation because they share answers; compare both against external measures and examine the reduced form in a separate administration.

| Axis | Reused answers in compact form | New statements | Total inputs |
| --- | ---: | ---: | ---: |
| E/I | 8 | 4 | 12 |
| S/N | 6 | 6 | 12 |
| T/F | 0 | 12 | 12 |
| J/P | 4 | 8 | 12 |
| **Total** | **18** | **30** | **48** |

Preserve the existing 170-item sequence and instructions initially. Append a clearly introduced preference module, with its axes interleaved and its order logged. This avoids silently altering the original administration while allowing an order-effects study later. Do not show target letters or scoring directions beside questions. The item definitions and appendix use editorial order; each form's `itemIds` supplies the actual interleaved presentation order.

## Exactly which current answers would be reused

The mappings below are content hypotheses for the compact experiment. None is a published MBTI item key. `+` means raw answer; `−` means 6 minus raw answer. Each included input has equal initial weight, 1/12 of its type-axis mean.

| Axis | Existing item IDs, with model-specific key | Reason and limitation |
| --- | --- | --- |
| E/I, high = E | 002+, 007+, 032+, 037+, 062−, 067−, 092−, 097− | Complete Friendliness and Gregariousness facets. Useful social orientation proxies; may overemphasize social ease. |
| S/N, high = N | 003+, 033+, 053−, 063+, 093+, 113− | Imagination plus philosophical/theoretical interest. May overemphasize fantasy; no claim of superior reasoning or intelligence. |
| T/F, high = F | None | Direct questions are preferable to equating kindness with F or hostility with T. |
| J/P, high = J | 010+, 040−, 070−, 100− | Complete Orderliness facet. A narrow proxy that must earn its inclusion against more direct closure items. |

All numeric IDs above have the prefix `ipip-neo-120-`. The JSON maps contain the full IDs, exact wording, original key, and every new-model membership. All unlisted existing items have zero type weight in the compact model; all existing items have zero type weight in `direct48`. Zero weight in a new view does not remove the item's original scoring role.

Do not replace a new question with an old question merely because an LLM thinks the sentences sound similar. Reuse requires the same answered content or a separately tested substitution. Even exact wording can behave differently under different instructions or item order.

## Initial scoring and the future learned weights

For any 1–5 type input x, apply its key **inside that model**:

```
keyed = x             when key = +1
keyed = 6 - x         when key = -1
axis_mean = sum(weight * keyed) / sum(weight)
```

Initial weights are 1 for each of 12 inputs. Positive directions are E, N, F, and J. A raw mean of 3 is the response midpoint, not a population norm. The default output is a continuous 1–5 mean, a centered preference from −2 to +2, and separate endorsement summaries for the two groups of newly written items. Someone can endorse preferences on both sides; the data should retain this instead of treating it as dishonest answering.

Four-letter output is disabled by default. For research previews, the code has an explicit opt-in policy: means above 3.25 receive the positive letter; means below 2.75 receive the negative letter; the inclusive interval 2.75–3.25 remains `?`. **This band is an arbitrary display rule, not a confidence interval, norm, validated threshold, or calibrated uncertainty estimate.** The kit supplies no percentage confidence and no claim about cognitive-function stacks.

True learned coefficients must come from a defined prediction task. For example, a separate regularized model can predict authorized MBTI Global Step I outcomes from a person's existing facets and new answers. Fit the model on development participants and evaluate on untouched participants. Coefficients and thresholds then belong to that exact model version, language, outcome definition, and population. The shipped `calibratedCoefficients` fields are deliberately null. Fabricating decimal weights now would add apparent precision without evidence.

Reuse does not require identical weights across models. A question can contribute to its original Big Five facet, one experimental type axis, and one color summary. The raw answer is stored once; each scoring model owns its key, transformation, weight, denominator, completeness requirement, and evidence status. Do not correlate a composite with its own ingredients and call that independent confirmation.

## A fully specified color view using current answers

This is an original display scheme. The color labels are convenient navigation; they do not identify Insights, DiSC, True Colors, Color Code, temperaments, or innate motives.

| Color | Exact meaning in this product | Existing facets | Calculation |
| --- | --- | --- | --- |
| Red | Direction and drive | E3 Assertiveness + C4 Achievement-Striving | Equal mean of eight original-keyed answers |
| Yellow | Social engagement | E1 Friendliness + E2 Gregariousness | Equal mean of eight original-keyed answers |
| Green | Care for others | A3 Altruism + A6 Sympathy | Equal mean of eight original-keyed answers |
| Blue | Structure and deliberation | C2 Orderliness + C6 Cautiousness | Equal mean of eight original-keyed answers |

Equivalently, each component facet receives weight 0.5 and each constituent item receives weight 0.125 after applying that facet's original key. These are transparent editorial weights, not fitted branded-color coefficients. Show the two component facets alongside the composite: for example, tidiness and deliberation can disagree.

Keep the raw 1–5 mean available. If the interface needs a 0–100 bar, use `25 × (mean − 1)` and label it **position on this response scale**. It is not a percentile, probability, or percentage of a person's identity. Do not normalize all four colors to total 100; people may endorse several of these tendencies. No color should imply competence, a career destination, compatibility, or moral worth.

A Jungian quadrant graphic using E/I and T/F is another possible presentation, but it would simply re-display two estimated dimensions. It would not be an independent second assessment, and it would not reproduce the proprietary Insights evaluator. That alternative is documented here but intentionally not mixed into this color scoring model.

## Optional established interpersonal extension

If the goal becomes measuring interpersonal behavior more fully, the public-domain **IPIP-IPC** is a more defensible starting point than inventing DISC weights from temperament stereotypes. It contains 32 items, four in each of eight interpersonal octants. Four statements already occur in the current bank apart from their terminal period:

| IPIP-IPC item | Current item | Existing wording | IPC key | Existing Big Five key |
| --- | --- | --- | ---: | ---: |
| 5 | ipip-neo-120-032 | Feel comfortable around people. | +1 | +1 |
| 21 | ipip-neo-120-037 | Talk to a lot of different people at parties. | +1 | +1 |
| 29 | ipip-neo-120-007 | Love large parties. | +1 | +1 |
| 32 | ipip-neo-120-089 | Am not interested in other people's problems. | +1 | −1 |

That would add **28 unique questions**, giving 246 with the full pilot or 228 with the compact candidate. It is optional and not included in the 218-question default. `optional-ipip-ipc.json` retains all 32 source items and the deduplication mapping. [S20–S22]

The original IPC instructions ask respondents to compare themselves with people of similar age and the same gender; the current form does not. Reusing answers under the current instructions is therefore an administration adaptation, even with identical wording. Validate it against a separately administered original form. Retain the source's unusual item 24 rather than silently editing a published key. The historical octant labels should be explained as scale labels, not judgments about the person.

## Validation plan: how to earn the word reliable

Established scale-development guidance emphasizes defining the construct, starting with a broad item pool, pretesting wording, studying dimensionality, and testing against related and distinct measures. A large alpha alone does not establish a useful construct. [S23–S25] All sample budgets, product gates, and model comparisons below are **proposed study-design choices**, not published validation of this new instrument.

1. **Set the target before collecting labels.** Decide whether success means a useful independent preference measure, agreement with MBTI Global Step I, or prediction of a named color assessment. Use separate external outcomes for each branded target. Record the administered version and language. Self-identified internet labels can be studied separately but should not be treated as verified official scores.

2. **Review content and comprehension.** Ask a psychometrician and independent reviewers to evaluate whether each item measures its intended preference rather than social skill, anxiety, diligence, kindness, literacy, or intelligence. Conduct about 15–25 cognitive interviews spanning the expected audience, revising in rounds. Specifically examine TF items where both answers sound desirable and the compact SN and JP proxies.

3. **Budget a development and confirmation sample.** A practical starting budget is roughly 800 development participants and 400 independent confirmation participants, with about 200 completing a retest after 2–4 weeks. These numbers are planning assumptions. A simulation or power/precision analysis must determine whether they support the factor structure, prediction targets, and subgroup comparisons you intend. Do not claim a demographic comparison is reliable if that subgroup is small.

4. **Keep participants and labels independent.** Fit preprocessing, item selection, thresholds, and coefficients only on development folds; split repeated responses by person. Avoid showing a newly generated type before collecting the comparison assessment. Counterbalance questionnaire order and examine the extra burden of the added items. No need to store or reproduce a vendor's protected item text to retain authorized comparison results.

5. **Compare models, rather than assume reuse works.** Baselines: existing five domains, then existing 30 facets. Candidates: direct48, hybrid48, and regularized combinations. Prefer simple coefficients unless a more complex model demonstrates useful held-out improvement. Start with complete documented scales; if removing an original item for a new predictor, preserve its original scoring role. Do not convert the baseline report into an unannounced new Big Five instrument.

6. **Measure several kinds of quality.** Examine ordinal factor structure, cross-loadings, method effects, model-appropriate omega and alpha, retest correlation and agreement, and response-pattern distributions. Test whether opposing poles actually behave as one bipolar dimension; independent endorsement may fit better. For predicting type letters, report per-axis balanced accuracy and confusion matrices as well as exact four-letter agreement. For continuous target scores, report correlation and prediction error. A stable error is still an error.

7. **Quantify uncertainty honestly.** Use out-of-sample calibration for any predicted probabilities. Estimate score uncertainty from a supported measurement model and report relevant retest classification stability. Do not call the 0–100 display a confidence value. Examine measurement invariance or differential item functioning before claiming the same scale works across languages or groups.

8. **Shorten only after the comparison.** Predefine acceptable losses in reliability, score agreement, construct coverage, and target prediction. Compare the compact form on held-out data, then test an actual 200-item administration, since scoring a subset of a 218-item session cannot fully test context and fatigue effects. Reject any reused item that does not earn its place. Forty-eight new items may be too many, too few, or the wrong set; the study decides.

9. **Publish the measurement specification.** Freeze the wording, response options, ordering policy, sample descriptions, keys, training procedure, cutoffs, missingness handling, and known limitations. Report unsuccessful model comparisons rather than silently choosing the best-looking result. Version future changes and retain old scores' versions. This supports transparent measurement rather than unexplained scoring flexibility. [S26]

For a nonclinical self-reflection product, an initial engineering target might be omega and retest coefficients around .80 or better for each intended dimension, with uncertainty intervals and no major construct problems. This is a planning target, not a universal standard or a guarantee. Passing it does not establish hiring validity, diagnostic validity, or official assessment equivalence.

## Implementation and permission boundaries

- **One raw answer record, several scoring specifications.** Use item ID, wording version, response-scale version, raw numeric answer or explicit missing status, administration ID, and displayed order. Do not persist one globally reverse-scored answer.
- **Original modules stay intact.** Personality facet and domain gates remain as supplied. O*NET requires the complete 30-item module before any interest score; TwIVI requires all 20 before centering. A missing original answer does not become a neutral one.
- **Extensions are independently optional.** Incomplete type axes and color composites are withheld locally. Completing the original 170 never auto-fills the new 48. Unselected extensions should not be interpreted as neutral.
- **Scoring is deterministic.** Use the JSON model definitions and tested functions. An LLM may explain the returned evidence and limitations, but should not invent answers, weights, types, probabilities, or clinical narratives.
- **Provenance follows every model.** Original instrument attributions and the source release identifiers are retained. The new item text is identified as an original unvalidated draft, and the color formulas as editorial composites. The kit includes no participant answers or personal scores.
- **Permissions are not validation.** IPIP permits reuse and modification; that does not certify a new combination. MBTI's publisher restricts reproducing its assessment material. OJTS's posted noncommercial share-alike terms are not an unrestricted commercial license. The new candidate text avoids copying those protected test banks. The unchanged O*NET and TwIVI provenance is carried forward from the original packet. [S01, S08, S10, S27]

The files are ready for research implementation. Their software correctness can be checked now; their psychological measurement quality still needs respondent data. No live questionnaire or website has been changed.

## Files

- `unified-questionnaire-bank.json`: 218 reusable item definitions, both forms, model-specific memberships, original scale definitions and provenance.
- `question-weight-map.json`: explicit original, type, and color roles for all 218 questions. An empty new-model list means zero weight.
- `additional-questions.md`: all 48 statements, keys, compact-form membership, administration instructions, and item-content concerns.
- `scoring.mjs`: dependency-free deterministic reference implementation, browser or Node compatible.
- `scoring.test.mjs`: meaningful checks for reverse scoring, missingness, mode selection, boundary responses, original module gates, and value centering.
- `optional-ipip-ipc.json`: optional published 32-item interpersonal measure, with four existing-item links and 28 new items.
- `sources.json`: primary-source and instrument-provider bibliography with evidence notes.

## Source list

See the numbered references below. Sources were reviewed on 22 September 2026. Provider descriptions are useful for identifying their constructs and restrictions; they are not treated as independent validation of the proposed new instrument.

**[S01]** [IPIP official public-domain statement](https://ipip.ori.org/). Instrument steward; reuse permission for IPIP items and scales.

**[S02]** [IPIP-NEO-120 official items and keys](https://ipip.ori.org/30FacetNEO-PI-RItems.htm). Existing instrument source identified in the supplied packet.

**[S03]** [McCrae & Costa (1989), Reinterpreting the MBTI from the perspective of the five-factor model](https://pubmed.ncbi.nlm.nih.gov/2709300/). Primary comparative research; overlap does not establish distinct categories or an individual conversion.

**[S04]** [The Myers-Briggs Company: MBTI Facts](https://www.themyersbriggs.com/en-US/Support/MBTI-Facts). Publisher evidence: seven-study/sample table, older MBTI/NEO forms, correlations corrected for unreliability using manual coefficients; not observed prediction accuracy.

**[S05]** [Myers & Briggs Foundation: The Preferences](https://www.myersbriggs.org/my-mbti-personality-type/the-mbti-preferences/). Official construct descriptions; no protected questionnaire items reproduced.

**[S06]** [The Myers-Briggs Company: MBTI Global Version](https://www.themyersbriggs.com/en-US/Access-Resources/MBTI-Global-Version). Global Step I has 92 items; Step II has 143. Version-specific counts.

**[S07]** [The Myers-Briggs Company: Facts and Common Criticisms](https://www.themyersbriggs.com/en-us/access-resources/articles/mbti-facts-common-criticisms). Publisher reports Global Step I scale test-retest correlations of .81-.86 at 6-15 weeks.

**[S08]** [The Myers-Briggs Company: Copyright and Permissions](https://www.themyersbriggs.com/en-US/Support/Copyright-and-Permissions). Publisher restrictions on reproducing protected material in websites, software, and databases.

**[S09]** [Open-Source Psychometrics Project: OJTS 2.1](https://openpsychometrics.org/tests/OJTS/). 48-item online version; expressly developed against internet users who already identify with a type.

**[S10]** [Open-Source Psychometrics Project: development and license](https://openpsychometrics.org/tests/OJTS/development/). Self-identified-type item selection; posted CC BY-NC-SA 4.0 license. No item bank copied into this kit.

**[S11]** [16Personalities: Our Framework](https://www.16personalities.com/articles/our-theory). Provider describes NERIS as reworked Big Five, rather than Jungian cognitive-function measurement.

**[S12]** [Insights Discovery: validating the system factsheet](https://www.insights.com/media/2728/insights-discovery-validating-the-system-factsheet.pdf). Provider methods, 25 frames/100 word pairs, alpha and retest summaries.

**[S13]** [Insights: Discovery model developer documentation](https://developers.insights.com/discovery-model). Official model description and API contact; does not grant questionnaire reuse rights.

**[S14]** [True Colors: four common personality types](https://www.truecolorsintl.com/tciblog/what-are-the-four-common-personality-types?hs_amp=true). Orange, Gold, Green, Blue; different meanings from Insights.

**[S15]** [True Colors: Research Precis](https://www.truecolorsintl.com/research-precis). Provider describes ipsative instrument and commissioned assessment review.

**[S16]** [ASI: True Colors construct-validity report, 2021](https://info.truecolorsintl.com/hubfs/TC-COLORS-VALIDITY-%20210715.pdf). Provider-hosted third-party report; interpretation must account for fixed-sum dependencies.

**[S17]** [Everything DiSC: The Science Behind Everything DiSC](https://www.everythingdisc.com/the-science-behind-disc). Provider scale reliability tables; relates to this instrument, not every DISC-branded test.

**[S18]** [Color Code: About](https://www.colorcode.com/about/). Provider theory of power, intimacy, peace and fun motives.

**[S19]** [Color Code: History of Personality Theory and Assessment](https://www.colorcode.com/media/whitepaper.pdf). Provider theory document; does not validate conversion from this questionnaire.

**[S20]** [Markey & Markey (2009), A brief assessment of the interpersonal circumplex](https://pubmed.ncbi.nlm.nih.gov/19667139/). Primary research on the 32-item IPIP-IPC, across three studies.

**[S21]** [IPIP-IPC official scoring key](https://ipip.ori.org/newIPIP-IPCScoringKey.htm). Public-domain 32-item key, all positive within each octant.

**[S22]** [IPIP-IPC official administration form](https://ipip.ori.org/newIPIP-IPCSurvey.htm). Public-domain wording and original administration instructions.

**[S23]** [Boateng et al. (2018), Best practices for developing and validating scales](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2018.00149/full). Methodological guidance, not evidence for the candidate questions in this kit.

**[S24]** [Clark & Watson (2019), Constructing validity](https://pubmed.ncbi.nlm.nih.gov/30896212/). Construct clarity, inclusive pools, related-construct testing, and dimensionality.

**[S25]** [McNeish (2018), Thanks coefficient alpha, we will take it from here](https://pubmed.ncbi.nlm.nih.gov/28557467/). Reliability estimators and limitations of relying on alpha alone.

**[S26]** [Flake & Fried (2020), Measurement Schmeasurement](https://doi.org/10.1177/2515245920952393). Transparent measurement decisions and avoidance of unreported scoring flexibility.

**[S27]** [IPIP administration guidance](https://ipip.ori.org/new_ipip-50-item-scale.htm). Permits mixing IPIP items; permission is separate from validating a new form.

## Appendix: all proposed additional questions

Research draft, 22 September 2026. These are 48 original, unvalidated statements, not official MBTI questions. The recommended pilot asks all 48 after the existing 170. The compact candidate asks the 30 marked Yes and reuses 18 existing answers. Neither form has established reliability yet. The number 48 is an initial design choice, not an empirically demonstrated optimum.

## Administration

Describe your usual preferences as you generally are now, across your life, when you have reasonable freedom to choose. Report what you tend to prefer, not what you are skilled at, what your job requires, or what sounds admirable. Different situations may bring out different preferences. Use the midpoint when a statement is neither accurate nor inaccurate; you may skip any statement. These items concern preferences, not ability, intelligence, kindness, or mental health.

Keep the existing personality response labels: 1 Very Inaccurate; 2 Moderately Inaccurate; 3 Neither Inaccurate nor Accurate; 4 Moderately Accurate; 5 Very Accurate. Skip is a separate nonnumeric response. Do not show scoring keys, target letters, or model labels alongside questions.

Positive score directions are E, N, F, J. Key +1 uses the original response; key -1 uses 6 minus the response. Every included item initially has unit weight. This is a declared provisional choice, not a published or calibrated MBTI scoring key.

| ID | Exact candidate wording | Endorsed pole | Key | In compact form? |
| --- | --- | --- | --- | --- |
| type-candidate-ei-01 | I work out what I think by talking it through with someone. | E | +1 | Yes |
| type-candidate-ei-02 | I prefer to form my thoughts privately before discussing them. | I | -1 | Yes |
| type-candidate-ei-03 | After a quiet day, I usually want some interaction with other people. | E | +1 | Yes |
| type-candidate-ei-04 | After an enjoyable social event, I usually want time on my own. | I | -1 | Yes |
| type-candidate-ei-05 | When I have a free afternoon, spending it with other people usually appeals to me. | E | +1 | Pilot only |
| type-candidate-ei-06 | I look forward to having an activity that I can enjoy on my own. | I | -1 | Pilot only |
| type-candidate-ei-07 | I tend to introduce a topic when a group conversation becomes quiet. | E | +1 | Pilot only |
| type-candidate-ei-08 | In a group conversation, I prefer to listen until I have something specific to add. | I | -1 | Pilot only |
| type-candidate-ei-09 | I like a day that includes frequent conversation. | E | +1 | Pilot only |
| type-candidate-ei-10 | I like long stretches of a day without conversation. | I | -1 | Pilot only |
| type-candidate-ei-11 | When both are available, I prefer discussing an idea live to exchanging written messages. | E | +1 | Pilot only |
| type-candidate-ei-12 | I find it easier to explore an idea when I can pause and reflect alone. | I | -1 | Pilot only |
| type-candidate-sn-01 | When I meet an unfamiliar problem, I first look for the broader pattern it might fit. | N | +1 | Yes |
| type-candidate-sn-02 | When learning something new, I prefer to begin with a concrete example. | S | -1 | Yes |
| type-candidate-sn-03 | An explanation interests me when it connects ideas that initially seem unrelated. | N | +1 | Yes |
| type-candidate-sn-04 | I trust an approach more when I can compare it with specific past experience. | S | -1 | Yes |
| type-candidate-sn-05 | I enjoy exploring possibilities before knowing whether they will be practical. | N | +1 | Yes |
| type-candidate-sn-06 | When someone describes an event, I want a clear account of what actually happened. | S | -1 | Yes |
| type-candidate-sn-07 | I tend to ask what a situation could become, beyond what it is now. | N | +1 | Pilot only |
| type-candidate-sn-08 | I prefer instructions that spell out the steps I can follow. | S | -1 | Pilot only |
| type-candidate-sn-09 | I usually want to understand the underlying principle before the details. | N | +1 | Pilot only |
| type-candidate-sn-10 | Specific observations are usually my starting point for making sense of a situation. | S | -1 | Pilot only |
| type-candidate-sn-11 | I find it natural to explain an unfamiliar idea by comparing it with a different subject. | N | +1 | Pilot only |
| type-candidate-sn-12 | I prefer descriptions that use literal examples over figurative comparisons. | S | -1 | Pilot only |
| type-candidate-tf-01 | When a decision affects several people, I begin by considering their individual circumstances. | F | +1 | Yes |
| type-candidate-tf-02 | When comparing options, I begin by defining criteria that apply equally to each one. | T | -1 | Yes |
| type-candidate-tf-03 | The effect a choice may have on a relationship is central to my decision. | F | +1 | Yes |
| type-candidate-tf-04 | I prefer to evaluate a proposal separately from my feelings about the person proposing it. | T | -1 | Yes |
| type-candidate-tf-05 | When a rule produces a difficult outcome for someone, I first consider whether the person's circumstances justify an exception. | F | +1 | Yes |
| type-candidate-tf-06 | When making an exception, I first consider whether I could apply the same reasoning to other cases. | T | -1 | Yes |
| type-candidate-tf-07 | When two workable options remain, I tend to favor the one that best reflects the values of the people affected. | F | +1 | Yes |
| type-candidate-tf-08 | When two workable options remain, I tend to favor the one that best meets the criteria agreed in advance. | T | -1 | Yes |
| type-candidate-tf-09 | When giving advice, I first explore what matters personally to the person asking. | F | +1 | Yes |
| type-candidate-tf-10 | When giving advice, I first map the likely consequences of the available options. | T | -1 | Yes |
| type-candidate-tf-11 | I find a decision hard to endorse if it conflicts with the personal values I bring to the situation. | F | +1 | Yes |
| type-candidate-tf-12 | I find a decision hard to endorse if its reasoning changes between otherwise similar cases. | T | -1 | Yes |
| type-candidate-jp-01 | For a shared activity, I prefer agreeing on a plan well before it begins. | J | +1 | Yes |
| type-candidate-jp-02 | For an open-ended task, I prefer deciding the next step as the work develops. | P | -1 | Yes |
| type-candidate-jp-03 | Once I have enough information for a workable choice, I prefer to settle it. | J | +1 | Yes |
| type-candidate-jp-04 | When there is time to decide, I prefer to keep several possibilities available. | P | -1 | Yes |
| type-candidate-jp-05 | I prefer knowing which tasks I intend to finish before I start the day. | J | +1 | Yes |
| type-candidate-jp-06 | I enjoy having room to change the order of my tasks during the day. | P | -1 | Yes |
| type-candidate-jp-07 | When arranging a trip, I prefer to settle the main details in advance. | J | +1 | Yes |
| type-candidate-jp-08 | On a day off, I prefer choosing activities as opportunities arise. | P | -1 | Yes |
| type-candidate-jp-09 | I like agreeing on a stopping point before starting a discussion. | J | +1 | Pilot only |
| type-candidate-jp-10 | I am comfortable leaving a plan unfinished while new information is still arriving. | P | -1 | Pilot only |
| type-candidate-jp-11 | Even when the stakes are low, I prefer having decisions settled. | J | +1 | Pilot only |
| type-candidate-jp-12 | I prefer arrangements that are easy to change when my interests shift. | P | -1 | Pilot only |

## Risks to examine before treating these as measures

- EI: social opportunity, fatigue, accessibility, writing preferences, or anxiety can affect responses. Private thought and social enjoyment can coexist.
- SN: imagination is not reasoning ability, novelty is not intelligence, and preferences for instructions can overlap with JP. In particular, SN-08 may cross-load on structure; test this rather than assuming purity.
- TF: people can endorse both consistent reasoning and attention to individual circumstances. TF-04 and TF-06 may attract broad socially desirable agreement. TF-11 may reflect independent conviction rather than the intended interpersonal emphasis. Test whether one bipolar factor, two correlated orientations, or a revised item set fits better.
- JP: work demands, caring responsibilities, resources, and stakes affect planning. Closure and adaptability are not opposites of diligence and laziness.
- Similar contexts and partially paired wording can create correlated residuals or inflate consistency. Do not keep redundant items solely to raise alpha. Both pole endorsement means are retained to expose information lost by a single difference score.

The compact form especially risks confusing social comfort with external orientation, fantasy with information preference, and tidiness with closure. Reuse is a hypothesis to test. Keep the direct pilot as a comparator and change the compact specification if validation does not support it.

