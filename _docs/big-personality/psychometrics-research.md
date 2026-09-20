# Psychometric foundation for Big Personality

Research date: 19 September 2026. This document distinguishes published evidence, directly sourced instrument content, and proposed product/research decisions. It does not use the owner's private report as a source of test items, scoring norms, or reusable prose.

## Recommendation

Use the **IPIP-NEO-120** as the complete Big Five core: 120 public-domain self-report items, five domains, six facets per domain, and four items per facet. Preserve the established item content and keys. Place tech-specific prompts and interpretations in separately identified modules. The deliverables are [question-bank.json](./question-bank.json) and [question-bank.md](./question-bank.md), which include every core item, keys, published item numbers, facet membership, source links, and scoring requirements.

This choice supports a detailed report while satisfying the request for at least 100 questions. It allows a transparent local implementation with no proprietary scoring service. A shorter instrument can be a later separate flow, but it should not claim the same 30-facet precision. A rewritten collection of work-themed questions would require validation as a new instrument.

Use “The Big Six-Seven” only as an experience name accompanied by an explicit explanation that the product combines the published Big Five with separate work-interest and personal-values lenses. Evidence for the core instrument does not validate the combined product. Do not claim to have discovered a new sixth personality factor.

## Evidence and what it establishes

### Original development and validation

Johnson (2014) developed the short form using an Internet sample of 21,588 and evaluated it using a community sample of 481, Internet samples of 307,313 and 619,150, and a local sample of 160. The study examined internal consistency, relationships with corresponding NEO PI-R scales, acquaintance ratings, and factor structure. Short-form facet scores correlated on average .66 with corresponding NEO PI-R facets before correction for unreliability. This supports a practical research and educational instrument, not interchangeable scores with every other Big Five test. The paper expressly cautions that four-item facets should probably not determine important decisions about individuals. [Johnson (2014)](https://doi.org/10.1016/j.jrp.2014.05.003); [author-hosted full text](https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/1/163537/files/2023/07/IPIPNEO120.pdf).

The official current key reports facet alpha estimates from the 619,150-person sample ranging from **.63 to .88**. All 30 values are stored with source and sample provenance in the question bank. These are internal-consistency estimates from that sample; they are not percentages correct, individual confidence, temporal stability, or guarantees for a different audience. [Official IPIP key](https://ipip.ori.org/30FacetNEO-PI-RItems.htm).

### Structural evidence and limits

Kajonius and Johnson (2019) examined 320,128 US respondents aged 19–69. They reported recognizable five-factor structure and tolerable fit for hierarchical and bifactor models, while also finding that facets varied in how strongly they represented their domains. Mean facet alpha was .78. The sample consisted of online volunteers; its size does not turn it into a probability sample of the public or of people working in technology. The findings support showing both domains and facets with restrained interpretation, rather than treating every facet as an equally precise independent axis. [Kajonius & Johnson (2019)](https://ejop.psychopen.eu/index.php/ejop/article/view/1671); [open full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC7871748/).

### Licensing and naming

IPIP states that items, scales, and inventories are public domain, with commercial and noncommercial use already permitted. Keep attribution and version provenance for scientific transparency even though a permission request is unnecessary. This permission does not transfer copyright in published papers, somebody else's report prose or graphics, or the proprietary NEO PI-R questionnaire. Call the core **IPIP-NEO-120**, explain its relationship to the Big Five, and cite its developer. [IPIP permission](https://ipip.ori.org/newPermission.htm).

### Source discrepancies are versioned data

The official website's item 58 uses “right and wrong”; the paper's Table 1 uses “right or wrong.” This bank fixes its text to the official website and explicitly records the paper variant. The official key also groups A3 and C4 items in a different order from the published administration order. The bank restores the published numbers without changing the website wording. Both facts are documented in the machine-readable provenance rather than silently corrected. [Official key](https://ipip.ori.org/30FacetNEO-PI-RItems.htm); [published Table 1](https://bpb-us-e1.wpmucdn.com/sites.psu.edu/dist/1/163537/files/2023/07/IPIPNEO120.pdf).

## Core construct map

| Domain | Canonical facets | What a report can discuss |
| --- | --- | --- |
| Neuroticism | Anxiety, Anger, Depression, Self-Consciousness, Immoderation, Vulnerability | Self-reported patterns of negative emotion, discomfort, and response to stress |
| Extraversion | Friendliness, Gregariousness, Assertiveness, Activity Level, Excitement-Seeking, Cheerfulness | Social approach, energy, assertiveness, stimulation, and positive emotion |
| Openness to Experience | Imagination, Artistic Interests, Emotionality, Adventurousness, Intellect, Liberalism | Engagement with ideas, imagination, experience, feelings, and unconventional perspectives |
| Agreeableness | Trust, Morality, Altruism, Cooperation, Modesty, Sympathy | Interpersonal trust, consideration, conflict, and self-presentation |
| Conscientiousness | Self-Efficacy, Orderliness, Dutifulness, Achievement-Striving, Self-Discipline, Cautiousness | Organization, persistence, preparation, follow-through, and deliberation |

These labels and memberships follow the [official key](https://ipip.ori.org/30FacetNEO-PI-RItems.htm). Report interpretations in the third column are proposed plain-language descriptions, not diagnostic definitions.

The report should explain loaded historical labels. “Depression” here is a personality facet, not a clinical diagnosis or validated depression screening result. “Intellect” is not an IQ or engineering ability score. “Morality” cannot establish a person's overall moral worth. “Liberalism” uses political and values wording that may not translate across cultures; it does not authorize inferring a user's political identity. An introverted score cannot establish poor communication, and lower Conscientiousness cannot establish laziness, ADHD, or job unsuitability.

## Administration specification

**Proposed product decision:** English-language adult self-reflection at launch, framed across general life rather than only a current job. Avoid requiring age, sex, employer, real name, diagnosis, or demographic identifiers to obtain a report. These are unnecessary for raw scoring. Demographic research belongs in a separate, optional, explicitly consented study.

Keep the official five accuracy response anchors, store literal integer responses, and save immutable item IDs. Show the published interleaved order. The IPIP administration page permits varied formats and recommends distributing items across constructs, so the ordering is a transparent product choice rather than a claim of a uniquely mandatory administration. Instruction changes and translations still need review for the intended population. [IPIP administration guidance](https://ipip.ori.org/new_ipip-50-item-scale.htm).

Suggested instruction, identified as product-authored: “Describe yourself as you generally are now, across your life, rather than only at work. Choose how accurately each statement describes you. There are no right or wrong answers. You may skip a statement.”

The form should provide:

- Clear five-point anchors on every page, with no default choice and no agreement/accuracy mixing.
- A visible skip control, back navigation, and a review screen showing missing responses.
- Autosave after each edit; resuming restores the exact bank version, answers, and order.
- Quiet section breaks and an estimated effort based on a usability pilot, not an untested completion-time promise.
- Keyboard, touch, screen-reader, zoom, and reduced-motion support; no timed answers.
- A short content notice before starting: the historical instrument includes emotional, political, and self-evaluative statements.

Do not prime respondents with trait explanations next to individual questions. The long-form educational introduction can explain what the overall instrument measures without revealing a desirable scoring direction. Do not rewrite “parties” as “stand-ups,” “art museums” as “design reviews,” or “binges” as “coding marathons”: those are different items. Add contextual reflection after the core.

## Scoring, completion, and uncertainty

For a raw response r from 1 through 5, positive items score r and reverse items score 6-r. Sum four items for each facet and 24 for each domain. This directly follows [official IPIP scoring instructions](https://ipip.ori.org/newScoringInstructions.htm).

**Proposed display:** retain original sums in the report data model; show a 1–5 mean for readability. Optional 0–100 rendering is `25 × (mean − 1)`, clearly labeled a position within the possible score range. It is not a percentile or a percentage of a personality trait. A midpoint score is not equivalent to average in a population. Do not compare raw means across traits to determine a “dominant” trait, because their distributions can differ.

**Proposed missingness policy:** allow the user to finish with skipped items. Score a facet only with all four responses, and a domain only with all 24. Display missing scales as incomplete with answered/required counts, while retaining the other complete scales. Do not replace missing responses with three, prorate silently, use an LLM to guess an answer, or require a sensitive answer to export a partial report. This policy preserves a simple auditable v1; it is not presented as an empirically established missingness threshold.

**No v1 confidence intervals.** A four-item facet does not justify printing a narrow precision band from general alpha values. A future classical-test-theory display could investigate `SEM = SD × sqrt(1 − reliability)` with compatible population, scale units, reliability evidence, and assumptions, but this is a planned analysis, not a ready-made individual interval. Test–retest change requires appropriate repeated-measures error estimates; alpha alone is insufficient. Do not call a small raw-score difference meaningful growth.

For the same reasons, do not label a report “87% accurate.” Display the assessment date, answered counts, exact bank/scoring versions, and a plain-language uncertainty statement: “These answers are a snapshot of how you describe yourself. Short scales and circumstances add uncertainty; use the results as hypotheses to reflect on.”

## Norms and percentiles

Ship **without normative percentiles**. The official IPIP norms page warns that generic comparison groups can mislead and favors relevant local comparisons. It links to archived data, including Johnson's repository, but does not supply a universal normative population for this community. The familiar million-person IPIP-FFM data set is a different, 50-item measure and must not be used to norm this 120-item bank. [IPIP norms and data guidance](https://ipip.ori.org/newNorms.htm).

If a later release adds percentiles, it must ship a reviewed static norm package that browsers can use without uploading answers. Proposed build pipeline:

1. Identify an authorized data release, instrument, wording/anchor version, codebook, sample dates, selection method, geography, age range, and reuse conditions. Record original and retained sample counts and all exclusions. Do not equate a huge convenience sample with a population norm.
2. Reproduce the published keys, item numbering, scale direction, and missing-data rules against the codebook. Audit item 58's wording variant. Verify whether existing fields are raw or already reverse-scored.
3. Compute and inspect score distributions, reliability estimates, and sample limitations offline. An independent reviewer must reproduce the pipeline from the same inputs.
4. Export small score-to-frequency tables for every supported scale. For tied discrete scores, a documented midrank percentile can use `100 × (count below + 0.5 × count equal) / N`. This is a proposed convention and must be labeled.
5. Package source identifiers, transformations, filtering script/version, checksum, calibration date, and scale compatibility. The report stores the norm-package version separately from the score and item versions.
6. Describe percentiles as relative to the named sample. Never say “top 10% of engineers” unless the reference actually supports that population inference. Do not automatically adjust scores by sex or age.

No external norm data were downloaded, cleaned, or converted into normative tables in this research deliverable. Such a package is a separate implementation and scientific-review gate.

## Report composition that remains academically honest

Use deterministic, reviewed report templates keyed to computed scores and user-selected reflections. Generative AI is unnecessary for measurement. The authoritative report should be reproducible even with JavaScript model inference disabled.

Recommended report order:

1. **Reading guide:** the meaning of self-report, the actual instrument, date/version, and whether the report is partial.
2. **Five-domain overview:** aligned horizontal ranges with the same raw scale, explicit score direction, exact numeric values available as text, and no ranking of the domains against one another.
3. **Facet detail:** six facets within each domain, showing completed scores and brief explanations. Collapse these initially to avoid overwhelming readers.
4. **Sixth lens:** separately labeled construct, scale, evidence level, and interpretation. The sixth lens must not alter Big Five scores.
5. **Tech reflections:** plausible contexts, questions, and reversible experiments. Attribute this layer to the product rather than to instrument validation.
6. **Personal notes and next experiment:** optional, locally stored, and excluded from public sharing by default.
7. **Methods appendix:** items or an item-bank link, keys, raw/derived score definitions, missingness, sources, norm status, and limits.

For each trait/facet section, write: “What these items ask about” → “What you endorsed” → “How this might show up” → “What context could change this” → “An experiment you could try.” Separate descriptive evidence from predictions. Avoid arbitrary raw-score bins called low/average/high before norms exist. Continuous wording, direct item-pattern summaries, and reader-selected examples can provide useful feedback without invented normative categories.

Examples of original editorial prompts, not validated predictions:

- For social-energy reflection: “Compare a week with many meetings to a week with more uninterrupted work. When did you contribute most effectively?”
- For stress reflection: “Choose a recent incident. Which parts reflected your usual reactions, and which followed sleep, workload, unclear ownership, or the team's processes?”
- For structure reflection: “Try a visible next-action list for a week, then judge whether it reduced friction.”
- For openness reflection: “Where does exploring alternatives help you, and where does a familiar tool help you finish?”
- For cooperation reflection: “Practice disagreeing with a proposal while stating the shared goal and the evidence you would accept.”

Do not prescribe careers, assign seniority, predict hiring success, or recommend ending relationships. Do not generate manager-versus-engineer archetypes or a compatibility grade from the raw scores. Users can write their own interpretation and disagreement with the report.

The official IPIP guidance treats traits as continua and cautions against sorting people into categorical personality types. Reflect that in the visual design and in social cards. [IPIP interpretation guidance](https://ipip.ori.org/InterpretingIndividualIPIPScaleScores.htm).

## A sixth lens must establish what it adds

The strongest conceptual approach is a separate motivational, interest, or environmental-fit profile that answers a different question from typical personality behavior. Calling it “distinct” means specifying a different construct and testing incremental information; it cannot mean promising zero statistical correlation with every Big Five domain.

Honesty–Humility is not automatically a distant extra in this bank: the core already contains Morality and Modesty facets. Adding a sixth scale does not transform IPIP-NEO into HEXACO, which reorganizes trait content. Likewise, “learning agility,” “grit,” “growth mindset,” “resilience,” and “systems thinking” should not be chosen merely because their names appeal to technology workers. Determine whether each proposed scale adds information beyond Conscientiousness, Openness, emotional stability, skills, and current job context. These are design judgments to be tested, not asserted findings of this memo.

Keep the core and each extension in separate namespaces, response instructions, completion counters, validation summaries, and report panels. Never compute a six-dimension total score. The seventh lens now uses the established 20-item TwIVI personal-values measure, with dedicated 1–6 portrait responses and within-person centering. This is a separate values profile, not a new personality factor. See the extension research for its evidence, exact items, scoring and limitations; original work reflections are separate editorial material.

## Validation and release gates

The following is a proposed research program, not completed validation and not an assertion that these participant counts are universally sufficient.

| Stage | Work | Release gate |
| --- | --- | --- |
| Content and code audit | Two independent checks of all 120 texts, keys, mappings, source version, and score arithmetic | No unresolved item or sign errors; discrepancies explicitly versioned |
| Comprehension and accessibility | Approximately 10–20 think-aloud sessions across engineering/product roles, career stages, and language backgrounds | Identify misunderstood wording, navigation failures, pressure to disclose, and misleading report language |
| Pilot | A preregistered convenience pilot on the order of 100–200 adults | Inspect completion, missingness, usability, response distributions, floor/ceiling effects, and score/report comprehension; report recruitment limits |
| Measurement study | Determine sample size from the actual model, precision, subgroup comparisons, and power/simulation; a planning envelope of 500–1,000 is not a guarantee | Estimate domain/facet reliability with uncertainty; examine factor structure, cross-loadings and measurement invariance where feasible |
| Retest subset | Planned repeat administration after a prespecified interval, for example 2–4 weeks; document intervening events | Estimate temporal stability and uncertainty without pretending repeated exposure is absent |
| Extension validation | Model sixth/seventh constructs jointly with the core and prespecified external criteria | Evidence of convergent/discriminant validity and incremental out-of-sample utility before strong individualized claims |
| Report evaluation | Compare report comprehension, perceived usefulness, stereotyping, distress, and user choices under different wording/layouts | Users understand score direction, non-percentile displays, uncertainty, and limits of career inference |
| Norm release | Independently reproduced compatible dataset pipeline | Signed-off provenance, permitted use, limitations, and frozen lookup tables |

Estimate alpha and an appropriate omega model with uncertainty; do not select whichever coefficient is largest. Four-item facets deserve special care. Use held-out data or cross-validation for model selection. Preregister hypotheses and report null/negative results. Keep exploratory improvements separate from confirmatory evidence.

Investigate construct overlap rather than demanding exact orthogonality. For the extension, compare a preregistered base model using the Big Five against a model adding the new lens, on a criterion that is actually relevant to self-understanding, such as preference fit or engagement. Include context and opportunity where appropriate. A small significant correlation in a huge sample is not a sufficient reason to promote a new “factor.”

The local-only app does not itself produce a research dataset. A separate voluntary research pathway must have its own consent, declared data flow, retention rules, and ethical review appropriate to the study. Declining research has no effect on access to one's report.

## Response-quality policy

The IPIP project describes response-pattern checks but explicitly treats validity indices as contested rather than a universal truth detector. [IPIP validity-index discussion](https://ipip.ori.org/newValidity.htm).

**Proposed v1 policy:** record completion and optionally local timing for usability, but never label a person dishonest or invalid because of speed, repeated choices, or atypical scores. Offer a neutral review prompt after an extreme uniform response pattern; allow the user to keep their answers. Do not add invisible attention checks to an instrument while still describing it as unchanged. Never make text-to-speech or assistive-technology users fail a time threshold.

Research exclusions should be preregistered and analyzed for sensitivity. Product-facing “confidence” badges must not be reverse-engineered from completion time, writing style, or an AI opinion.

## Report, media, and sharing safeguards driven by measurement

Generated art should explain the reading journey or decorate a section, not claim to visualize an objectively discovered brain/personality type. Avoid high-score halos, low-score danger colors, distorted faces, or occupational stereotypes. A chart's numeric coordinates must come from the deterministic scorer, not from an image model.

Audio should read the same reviewed explanation with user-initiated playback. A soothing or authoritative voice does not strengthen the evidence. Sound selection must not infer an emotional diagnosis, and spoken numbers must match the report JSON.

A shared URL or card should include only explicitly selected derived data and version metadata. Exclude raw answers, notes, political item responses, and facet details by default. Explain that a recipient can copy or forward a link; a local-only app cannot revoke a public serialized URL. A shared self-report is unauthenticated user-provided content, not proof of a verified trait profile. A PDF must preserve the same measurement explanation and partial-score state as the accessible web report.

## Principal references

- Johnson, J. A. (2014). Measuring thirty facets of the Five Factor Model with a 120-item public domain inventory: Development of the IPIP-NEO-120. *Journal of Research in Personality, 51*, 78–89. [DOI](https://doi.org/10.1016/j.jrp.2014.05.003).
- Kajonius, P. J., & Johnson, J. A. (2019). Assessing the Structure of the Five Factor Model of Personality (IPIP-NEO-120) in the Public Domain. *Europe's Journal of Psychology, 15*(2), 260–275. [Journal and DOI](https://doi.org/10.5964/ejop.v15i2.1671).
- International Personality Item Pool. [Official IPIP-NEO-120 key](https://ipip.ori.org/30FacetNEO-PI-RItems.htm); [permission](https://ipip.ori.org/newPermission.htm); [scoring](https://ipip.ori.org/newScoringInstructions.htm); [administration](https://ipip.ori.org/new_ipip-50-item-scale.htm); [norms and data](https://ipip.ori.org/newNorms.htm); [interpretation](https://ipip.ori.org/InterpretingIndividualIPIPScaleScores.htm); [response validity](https://ipip.ori.org/newValidity.htm). Accessed 19 September 2026.
