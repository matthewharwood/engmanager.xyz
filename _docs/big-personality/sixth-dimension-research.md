# The Big Six-Seven: the sixth and seventh lenses

Research and product recommendation · 2026-09-19

## Decision

Use **The Big Six-Seven**, subtitled **Big Five personality + work interests + personal values**. The sixth lens is **Work Interests**, measured by the complete 30-item O*NET® Mini Interest Profiler (Mini-IP). The seventh is **Personal Values**, measured by the published 20-item **Twenty Item Values Inventory (TwIVI)**. Both are scored from established questionnaires, not invented traits or free-form interpretation. Together with IPIP-NEO-120, the complete assessment has **170 rating items**.

The three questions differ: personality asks “How do I typically think, feel, and act?”; interests ask “What activities attract me?”; values ask “What ends and principles matter to me?” The name is a deliberately playful editorial brand. It does not describe seven orthogonal personality factors. Work Interests contains six RIASEC scores, and Personal Values contains ten value scores. Never collapse either profile to one sixth or seventh scalar, or combine everything into a personality-quality total.

No candidate justifies promising that it does not overlap with the Big Five. Distinct constructs can correlate. The defensible goals are conceptual distinction, discriminant validity, and useful information beyond trait scores. A meta-analysis of 43 samples / 19,872 participants estimated Big Five–RIASEC correlations between −.08 and .36. This supports meaningful separation, not zero dependence. [Hurtado Rúa, Stead, & Poklar, 2019](https://doi.org/10.1177/1069072718780447)

## Why interests earn the sixth slot

Interest measures concern the appeal of activities rather than how competent somebody is at them. This matters for an early-career engineer who is good at a task but finds it draining, or a product person who has not yet had access to work they might enjoy. Keep preferences separate from current skill, credentials, pay, and opportunity.

A German cohort of 3,023 school leavers followed for ten years found that vocational interests predicted several later outcomes above Big Five traits and cognitive ability. This is evidence for interests as an additional lens; it does not establish that this blog tool predicts an individual's success, salary, health, or ideal technology role. [Stoll et al., 2017](https://pubmed.ncbi.nlm.nih.gov/27560608/)

The official Mini-IP development study selected five items for each of six interest areas using multiple psychometric and content criteria. Appendix A provides the complete wording and order. Its validation sample contained 575 adults recruited through MTurk, not a representative sample of junior technology workers. The results support the instrument's stated career-exploration use, subject to that context. [Rounds et al., 2016](https://www.onetcenter.org/dl_files/Mini-IP.pdf)

The O*NET manual reports Mini-IP alpha estimates of .74–.81 and omega estimates of .76–.83 in that 575-person sample. These are group-level reliability estimates, not confidence percentages for a particular person's result. It also reports associations such as Artistic–Openness/Intellect and Enterprising–Extraversion; RIASEC is not independent of personality. [O*NET Interest Profiler Manual, chapters 5–6](https://www.onetcenter.org/dl_files/IP_Manual.pdf)

### Tech applications: editorial hypotheses to explore

Show the official RIASEC labels and a short explanation. Separate the following examples visually from the measured result, labeling them **Experiments to try**. They are product suggestions, not validated career matches.

| Interest dimension | Activity emphasis | A small experiment in technology work |
| --- | --- | --- |
| Realistic | Practical work with tangible things and equipment | Try a hardware prototype, device setup, or physical computing workshop. |
| Investigative | Discovering explanations and examining evidence | Trace an unfamiliar defect, inspect an experiment, or investigate user behavior. |
| Artistic | Creating and expressing original ideas | Prototype an interaction, write a product narrative, or explore a new visual direction. |
| Social | Helping, teaching, and developing people | Pair with a new contributor, improve onboarding, or explain a concept to peers. |
| Enterprising | Persuading, initiating, and organizing toward a goal | Present a proposal, facilitate a prioritization discussion, or run a small initiative. |
| Conventional | Organizing information and following structured processes | Improve a runbook, audit structured data, or make a repeatable release checklist. |

Do not infer that a software engineer must be Investigative, a product manager Enterprising, or a designer Artistic. Each role contains multiple activities; these examples test a hypothesis about enjoyment. A low Realistic result is not a claim that someone dislikes software engineering. Broad activity items deliberately include work outside technology. Rewriting them to mention code would change the instrument.

An example report paragraph: “Investigative and Social activities were among the interests you endorsed most strongly. You could test that combination by pairing on a difficult debugging problem and then writing an explanation for another newcomer. Notice whether you enjoy the investigation, the teaching, both, or neither.” Do not convert this into “You are a born technical lead.”

## Alternatives considered

| Candidate | What it could add | Why it is not the sixth lens for this product |
| --- | --- | --- |
| HEXACO Honesty–Humility | Sincerity, fairness, lack of greed and entitlement | It is a serious alternative personality framework, but not simply the existing Big Five plus one independent score. It overlaps with some Big Five facet content, and HEXACO also reorganizes other trait content. If six personality traits are mandatory, evaluate the full HEXACO model instead of bolting on an H–H scale. |
| Intellectual humility | Acknowledging limits and revising beliefs | Relevant to design reviews and debugging, but associated with openness-related characteristics and sensitive to definition, measurement, and situation. Better as reflection on a recent decision than a supposedly distant sixth factor. |
| Cognitive abilities | Performance on reasoning and knowledge tasks | Conceptually useful, but not measurable by “I am analytical” agreement items. A credible ability assessment needs appropriate performance tasks, norms, accessibility accommodations, and validation. Exclude from this self-reflection launch. |
| Grit | Perseverance and consistency of interest | Substantial redundancy with conscientiousness; weak fit to the request for distant information. |
| Personal values | Desired ends and guiding principles | Selected seventh lens via the published TwIVI: a person may enjoy an activity yet prioritize different goals or reject its impact. This is a general personal-values measure, not a workplace-conditions scale. |
| Skill / experience / current conditions | What someone has learned and what their environment permits | Useful context questions, not personality dimensions. Keep self-reported skill, role, tenure, caregiving constraints, and current workload explicitly separate. |

HEXACO's authors describe different placements of some traits across Honesty–Humility, Agreeableness, and Emotionality, and research compares the models rather than treating all their shared labels as interchangeable. [HEXACO history](https://hexaco.org/history), [Ashton & Lee, 2008](https://www.sciencedirect.com/science/article/pii/S0092656608000469)

The current HEXACO instrument page restricts free use to nonprofit academic research and restricts publicly accessible online administration under that permission. The authors direct nonacademic uses to contact them. Do not copy its items into a public blog merely because the forms are downloadable. [HEXACO instrument terms](https://hexaco.org/hexaco-inventory)

Leary and colleagues studied intellectual humility across four studies and found associations with openness, curiosity, ambiguity tolerance, and low dogmatism. This is useful evidence, but it does not validate a custom “engineer humility” quiz. [Leary et al., 2017](https://pubmed.ncbi.nlm.nih.gov/28903672/)

A more recent situated-behavior study asked people about recent disagreements and found substantial within-person variation across contexts in two populations. It supports asking what happened in a decision rather than assuming one self-rating captures how a person always behaves. This is an optional future direction, not a required extra score. [Rudnev et al., 2026](https://pubmed.ncbi.nlm.nih.gov/42082861/)

Grit's strong association with conscientiousness and disputed higher-order structure are documented in a meta-analysis covering 88 independent samples and 66,807 people. [Credé, Tynan, & Harms, 2017](https://pubmed.ncbi.nlm.nih.gov/27845531/)

Personality and cognitive ability also show patterned associations, including facet-level relationships. Their distinction does not imply statistical independence, and trait questionnaires should not be reported as intelligence tests. [Stanek & Ones, 2023](https://pmc.ncbi.nlm.nih.gov/articles/PMC10266031/)

## Seventh lens: Personal Values, measured with TwIVI

TwIVI measures ten Schwartz personal values with two portraits each: conformity, tradition, benevolence, universalism, self-direction, stimulation, hedonism, achievement, power, and security. Preserve its broad life frame. A product can offer workplace applications after scoring, but changing the portraits to mention engineering or product work would create a different instrument.

The authors developed it with 38,049 respondents and evaluated it in a separate sample of 29,143. The main samples came from a Facebook application and were largely U.S.-based. TwIVI alpha estimates in the evaluation ranged from .33 to .91; Security (.33) and Tradition (.50) warrant particular caution. Two-week test–retest correlations ranged from .51 to .81, with only 46 returning TwIVI respondents. These findings support a brief research measure while limiting confident interpretation of small individual differences. [Sandy et al., 2016, tables 1 and 7](https://gosling.psy.utexas.edu/wp-content/uploads/2016/12/Sandy-et-al-JPA-2016-Brief-values-measures.pdf)

### Permission and exact administration

The [official Gosling lab page](https://gosling.psy.utexas.edu/two-short-measures-of-values-tivi-and-twivi/) expressly permits anyone to use TwIVI for any purpose without requesting permission. Record that permission and source URL; do not mislabel it CC-licensed or public domain. The bank was extracted from the linked [official administration DOCX](https://gosling.psy.utexas.edu/wp-content/uploads/2016/12/TwIVI-TIVI-Administration-and-Scoring-Instructions.docx), whose SHA-256 is in the JSON. Cite Sandy, Gosling, Schwartz, and Koelkebeck and retain the complete wording, key, and instructions.

The official instructions support preferred-pronoun branching, including he, she, or they. The bank retains exact `sourceText` and separately stores reviewed display variants, including required verb agreement. This is a portrait-wording preference, not a required gender question. Singular they is the default. Do not infer demographics or expose this preference in sharing.

Readers choose how similar they are to the person portrayed, using six anchors: 1 Not like me at all; 2 Not like me; 3 A little like me; 4 Somewhat like me; 5 Like me; 6 Very much like me. There are no reversed items. The module needs its own six-option controls and instructions; reusing the Big Five five-option response scale would be a scoring error.

### What makes values a distinct additional lens

A 60-study meta-analysis supported the distinction between Schwartz personal values and Big Five traits while finding coherent associations. That evidence supports adding values; it does not make them independent. [Parks-Leduc, Feldman, & Bardi, 2015](https://pubmed.ncbi.nlm.nih.gov/24963077/)

Interests and values also relate. Two career-counseling studies with 97 and 545 participants found expected associations, such as Social interests with benevolence and Enterprising interests with power/achievement. This is evidence about connected constructs, not evidence that the same measure can stand in for both. [Sagiv, 2002](https://cris.huji.ac.il/en/publications/vocational-interests-and-basic-values/)

The distinction is conceptual and useful: two people can enjoy running an initiative but prioritize different ends, such as influence, helping others, autonomy, or security. This is an illustrative hypothesis, not a finding about this specific questionnaire combination. The sources reviewed do not establish that TwIVI incrementally predicts tech-career outcomes above both IPIP-NEO-120 and Mini-IP in this community. That claim requires a new study. Do not promise zero overlap or a newly discovered seventh trait.

### Personal-values scoring contract

For each value, average its two answers: items 1+11, 2+12, and so on in the order above. Retain these **raw means, 1–6**, as an inspectable score. For the relative-priority view, compute the reader's `grandMean = sum(all 20 responses) / 20` and `centeredPriority[value] = pairMean[value] - grandMean`. The author gives person-mean centering as an analysis method for response-level differences. Here it is displayed explicitly as relative priority within the person's answers, not as norm-referencing. [Official scoring instructions](https://gosling.psy.utexas.edu/two-short-measures-of-values-tivi-and-twivi/)

Retain integer `pairSum` and `totalSum`. The exact centered numerator is `10 * pairSum - totalSum`, with denominator 20. The ten centered values sum to zero before rounding; each has a theoretical range of **−4.5 to +4.5**, because its two answers contribute to the grand mean. These centered scores are mathematically dependent. A negative score means lower endorsement relative to the reader's other measured values, not rejection or moral failure. A flat profile has no leading priority.

Require all 20 valid responses before producing a final values profile. The entire module can be skipped, and individual unanswered items stay `null` while a draft is incomplete. This conservative completeness rule is a product decision, not a published missing-data estimator. Never fill unanswered religion or government items with neutral scores. Preserve ties; describe near-ties cautiously; provide no values percentile, moral rank, job-fit verdict, or “best values” list.

Use a ten-row diverging dot plot for relative priorities, a visible zero reference labeled “your average endorsement,” and a raw-mean table. Do not use the same axis as Big Five response means or RIASEC totals. Offer a plain-language explanation and allow the reader to disagree. Show the broad concepts as tendencies and trade-offs, not a verdict on character.

### Limits that must appear in interpretation

- Each value has only two items; do not claim precise ranking when differences are small.
- The Tradition portraits include religion and customs. Lower endorsement does not prove lack of secular cultural attachment or meaning.
- The Security pair asks about order/cleanliness and stable government. Its score is not a measure of job security, risk tolerance, or financial caution.
- Power concerns leadership and control in these portraits; it is not leadership ability or ethical worth. Hedonism is not a vice label.
- The official value labels are not interchangeable with the similarly named Big Five or RIASEC scales. For example, value Achievement is not the IPIP achievement-striving facet, and Self-Direction is not simply Openness.
- Do not infer political beliefs, religion, identity, or employer suitability from aggregate scores. Keep the complete values profile private unless explicitly selected for an appropriate export; public links exclude it in v1.

### Alternatives and retained reflection material

The O*NET Work Importance Locator was retired on June 3, 2024; its official archive states research-only use and discontinued support. It uses a forced card sort, not interchangeable five-point ratings. It is not the selected public-product instrument. [O*NET WIL archive](https://www.onetcenter.org/reports/WIL_Archive.html)

The broader Schwartz repository contains several different instruments and has its own noncommercial/no-derivatives notice; TwIVI's specific author permission must not be generalized to all of them. [Schwartz repository](https://scholarworks.gvsu.edu/orpc/vol2/iss2/9/)

The original 24 project-authored work prompts survive only in [original-work-reflections.md](original-work-reflections.md) as an optional unscored conversation appendix. They are not the seventh lens, are not part of the 170-item assessment count, and carry no measurement or validation claim.

## O*NET implementation and licensing requirements

Use the complete 30-item block, original order, original item text, five response labels, and published scoring. Keep the Big Five and TwIVI as separate modules and separate score namespaces. The JSON bank records source item positions and all license/provenance metadata. Do not put these items under the repository's general code license by accident.

O*NET offers CC BY-ND 4.0 for copying an unmodified tool with attribution, and a separate Tools Developer License for adaptations. The latter requires validation when content or purpose changes; its software-integration exception does not authorize rewriting item content. The proposed implementation is an unmodified assessment module incorporated into the site, with editorial reflection presented separately. Before release, compare the entire administration flow to the official materials, including instructions and interpretations. If the implementation changes content, scoring, purpose, or official interpretation, treat that as an adaptation and satisfy the developer-license conditions before releasing it. [License options](https://www.onetcenter.org/license_tools.html), [Developer License §3(b)](https://www.onetcenter.org/license_toolsdev.html)

Display the official attribution beside the module and in methodology / PDF credits, with working links:

> This page includes information from the O*NET Career Exploration Tools by the U.S. Department of Labor, Employment and Training Administration (USDOL/ETA). Used under the CC BY-ND 4.0 license. O*NET® is a trademark of USDOL/ETA.

Attribution links: [O*NET Career Exploration Tools](https://www.onetcenter.org/tools.html), [USDOL/ETA](https://www.dol.gov/agencies/eta), [CC BY-ND 4.0](https://creativecommons.org/licenses/by-nd/4.0/).

This dossier supplies the complete question block and scoring specification, not a claim that a future public implementation has passed a license or psychometric review. No hosted API, account, or network request is needed to administer or score the local question block. If occupation matching is added later, use the official matching method and a versioned local dataset; do not equate a hand-authored technology activity list with O*NET occupation matches.

## Scoring contract and report behavior

- Persist Mini-IP answer values as integers 1–5, matching the official web-service response encoding. Reject any other type or value.
- For published Mini-IP score units, sum `answer - 1` over the five items per RIASEC domain: each result ranges from 0 to 20. The development report describes equivalent 0–4 response coding. Preserve the coding version in exports. [Development scoring section](https://www.onetcenter.org/dl_files/Mini-IP.pdf), [API response encoding](https://services.onetcenter.org/reference/mnm/ip/ip_questions_30)
- Report the six raw scores together, labeled “interest score, 0–20.” These are not population percentiles, probabilities, or measures of ability. Do not mix the domain names E/C with Big Five Extraversion/Conscientiousness in schemas; use full names or a `riasec` namespace.
- A reader may skip the entire module. A completed module requires all 30 answers; missing answers remain `null`, are never imputed as neutral, and do not yield a final RIASEC profile. Preserve progress locally. Incomplete results can show completion only.
- Keep ties. A three-letter interest code can be an optional summary only after a clearly communicated tie treatment; the full six-score vector remains primary. Do not manufacture a rank ordering from equal scores.
- A flat profile has no leading interest. Show that plainly and suggest trying activities. Do not divide by zero in profile-correlation matching. Repeated answers may express a true preference; never accuse the reader of dishonesty.
- Retain instrument version, item-bank hash, answer encoding, scoring version, and completeness in local exports. Shared summaries should not contain raw answers, free text, or the values exercise by default.
- Keep normative Big Five scoring and within-person interest comparisons separate. A high interest response is not evidence of higher ability, job suitability, moral value, or greater personality health.

## Validation plan for the actual community product

The app's implementation and editorial advice do not inherit validation simply by hosting established questionnaires. Before launch, verify transcription, reverse-key handling in the Big Five, Mini-IP score units, mobile accessibility, translations, saved-progress behavior, and accurate labeling. Use cognitive interviews with early-career engineering and product readers to find confusing instructions without editing established items casually.

For the combined assessment, preregister the proposed interpretation and incremental-usefulness claims, recruit beyond the author's followers, and use a psychometrician to plan sample size and analysis. Evaluate TwIVI structure, reliability, retest behavior, language/pronoun effects, measurement invariance / differential item functioning, and added usefulness beyond Big Five and RIASEC. Established source measures do not automatically validate the combined report or its application to early-career tech workers. The optional original reflection appendix remains unscored.

Test whether the report improves self-understanding and supports useful experiments, rather than rewarding agreement with flattering descriptions. Any research-data contribution should be separate, opt-in, explicit about what leaves the device, and unnecessary for using the assessment. The client-only launch cannot quietly assemble community norms.

### Specific release gates

1. All 30 Mini-IP items compare exactly with the published Appendix A, with the final updated item 6 wording preserved.
2. Golden fixtures: all answer values `1` produce six zeroes; all `3` produce six tens; all `5` produce six twenties; changing one answer affects only its domain by the same number of points.
3. O*NET attribution and license links are present in the module, methodology, and exported report; no O*NET endorsement is implied.
4. The TwIVI block matches the official 20 items, six anchors, key, full instructions, and author-approved pronoun handling; all centered-score fixtures pass. State two-item precision limits. Keep original work reflections unscored and outside the item count.
5. Every technology example is presented as an optional activity to explore, not a validated role classification or deterministic career recommendation.
6. The report explains that The Big Six-Seven is a product label and makes no independence claim or overall seven-factor score.
