# Your Story: research and product design

22 September 2026

## The idea

Make the report feel like a small illustrated journey: the person's patterns, the worlds they grew up in, what matters now, and an optional symbolic closing. “Your Story” is a better user-facing name than “background check”: the app collects voluntary self-report and performs no verification or investigation.

The aim is richer relevance and enjoyment, not the maximum amount of identifying data. Name can mean nickname. Birthday is useful for chosen calendar symbols but not necessary for the psychological report. A meaningful question about family expectations provides more individual context than assuming a cultural tendency from skin color or a passport.

## The research the user may remember

The likely book is Michele Gelfand's **Rule Makers, Rule Breakers** [C05]. The specific agricultural mechanism is Thomas Talhelm and colleagues' rice-versus-wheat research [C01]. These are related research strands, not a certain identification of a single remembered book.

The 2014 study linked historical rice agriculture with more interdependent and holistic responses within China. A 2020 paper directly studied historical rice farming and stronger social norms [C02]. A 2024 study used quasi-random assignment to two state farms, strengthening evidence for the proposed mechanism in that setting [C03]. This is about social coordination and historical institutions, not the claim that eating rice changes someone's personality.

Gelfand's tightness-looseness construct concerns the strength of shared norms and tolerance for departures from them [C04]. Interdependence concerns relations and mutual reliance; they are related but distinct. Neither is equivalent to friendliness, introversion, obedience, or an individual's intelligence. None of these studies supplies coefficients for turning this respondent's race or birthplace into a trait score. The specific handedness detail was not established from the sources reviewed here and is not used in the instrument.

The new BG23-BG30 questions therefore ask directly about reported expectations, consequences, acceptable life paths, coordination, autonomy, and changing settings. Keep the answers as descriptive context. Do not average them into a claimed validated “tightness score,” national rank, or cultural diagnosis.

## Personality and symbolism have different evidence

The existing IPIP-NEO-120 has an empirical development and validation history [C06]. That does not make every narrative claim from a test valid, but it is not equivalent to astrology. The new type preference questions still need validation. The original color view is an editorial summary of facets. Birthday symbolism and tarot are creative content and receive no personality weight. Historical experimental tests of astrology belong to a separate evidence discussion [C07]; the product does not need to claim predictive validity to offer an enjoyable symbolic exercise.

Tarot has also been used as visual art and a structure for reflection, including major reinterpretations described by The Met [C12]. This kit's 78 prompts are original editorial writing, not quotations from a commercial guidebook. Its use is opt-in for every participant. Do not assume that a Black participant, a woman, or a member of any cultural community wants tarot or shares a belief system.

## The question bank

There are 36 optional multiple-choice questions, with explicit single/multiple selection rules, stable option IDs, and a narrative-use statement for each. A nickname and date picker are two separate optional inputs. The complete wording is in `background-questions.md` and the app-readable bank.

| Area | Items | Purpose |
| --- | --- | --- |
| Identity and biography | BG01-BG13 | Approved name/pronouns, self-described identity, places, language, households, traditions, and belonging |
| Practical circumstances | BG14-BG20 | Resources, learning paths, current roles, responsibilities, schedule control, and realistic time |
| Goals and transitions | BG21-BG22 | What the report should help with now |
| Rules and belonging | BG23-BG30 | Firsthand experience of social norms, cooperation, autonomy, and context switching |
| Support and presentation | BG31-BG36 | Helpful support, voice, action format, story style, and specific symbolic opt-ins |

The identity options are broad and partly US-oriented because the user named US racial/ethnic categories. They permit multiple selections and self-description. Hispanic/Latino identity can coexist with Black or White identity. Cultural affiliation, race, nationality, birthplace, current residence, and home language remain separate. Localize and cognitively test labels with the intended audience before release.

No full legal name, street address, government identifier, employer name, bank information, criminal history, medical diagnosis, or immigration-status question is needed. The app should never search public records. Do not treat less disclosure as less engagement or an inferior report.

## A game flow that rewards exploration

1. **Choose your edition.** Practical report, illustrated story, or playful illustrated story. Explain that symbols are optional.
2. **A short preface.** Nickname, preferred report voice, main goal, realistic time, and optional symbol choices. Birthday appears only when relevant. Offer a skip path of equal prominence.
3. **Take the assessment.** Keep each instrument's wording, response scales, and completeness rules. No tarot reveals or suggested type before answers are finished.
4. **Reveal the patterns.** Show exact results and the limits of experimental views. Offer optional “Your roots,” “Your circumstances,” and “Rules and belonging” chapters to enrich the story.
5. **Draw three cards.** Animate a shuffle briefly; respect reduced-motion settings; provide keyboard controls. Use one actual random draw, persist it, and let the user explicitly redraw. Keep the selected draw ID, with redraws labeled as new draws. No draw is chosen from the personality or demographics.
6. **Review the packet.** Show exactly what will leave the app. Identity, location, and other sensitive answers start unchecked. Birthday never goes into the standard export. Users can include derived symbols without sharing the date. Do not gate the PDF or card draw on demographic disclosure.
7. **Create and keep the story.** Download Markdown for the chosen LLM. Show a private preview before sharing a PDF. A separate user-confirmed share may include selected prose; no automatic public profile or compatibility ranking.

There is no “personality level” or reward for more sensitive information. Progress can celebrate completed chapters or chosen reflection exercises while counting skipped chapters as resolved.

## Birthday calculations

**Western:** this reference uses common tropical sun-sign date ranges. They are a date-based approximation, not an astronomical chart. It flags dates within one day of a conventional transition as unresolved between two signs. Exact cusp resolution needs a suitable ephemeris and birth instant/time-zone convention; the product currently does not request the extra identifying details or compute a natal chart. No Moon or rising sign is inferred.

**Chinese:** this reference uses the Chinese lunar-calendar year, with Lunar New Year as the boundary. It does not silently substitute the alternative Li Chun convention or another culture's animal cycle. The Hong Kong Observatory provides Gregorian-lunar conversion tables [C08-C11]. Births before Lunar New Year can belong to the preceding animal year: 9 February 2024 is Rabbit, while 10 February is Dragon. On 28 January 2025 it is still Dragon; on 29 January it is Snake. In 2026, the boundary is 17 February, Snake to Horse.

The code uses supported `Intl` Chinese-calendar date parts and checks the selected calendar [C14]. It treats a entered Gregorian birthday as a civil date at UTC noon and explicitly documents that convention; it is not a historical birth-instant conversion. No year-only fallback is permitted. Production should pin a reviewed calendar implementation/data version and add historical boundary fixtures for its supported birth-year range. Calendar support failure yields an unavailable symbol, not a guess. The packet exports animal/sign/status, not the birthday or inferred birth year.

## The tarot deck and assets

All 78 cards are present: 22 Major Arcana and four 14-card suits. The numbering uses Strength VIII and Justice XI. Court names remain conventional labels, not gender assignments to a reader. Card themes and questions are original editorial interpretations. Reversals are off by default; the optional reversed treatment asks about a blocked, excessive, or irrelevant theme instead of predicting misfortune.

The three positions are “What is present,” “A useful question,” and “A small next step.” Death, The Devil, The Tower, and difficult Swords cards never become claims of impending harm. A reader can reject a metaphor without failing the exercise. The default draw uses browser cryptographic randomness with rejection sampling, without replacement. Store the returned card IDs and orientation, and reuse them when generating another report.

Front artwork is deliberately placeholder art: precise labels, stable card IDs, a shared visual system, and suit motifs in editable SVG and PDF-friendly PNG. One generated back sets the visual direction. The manifest has 78 future image prompts so individual illustrations can replace placeholders while keeping URLs and IDs versioned. Nothing is copied from a modern commercial deck.

## Cloudflare and PDF behavior

The actual asset domain is unknown. This kit uses `assetBaseUrl: null`; `example.invalid` is explanatory only. A production upload can use an R2 bucket with a custom asset domain, following Cloudflare's public-bucket guidance [C13]. Use content-addressed/versioned paths, correct MIME types, documented origins, and manifest checksums. Do not put answers or demographic data into query strings or public bucket objects.

The LLM may have no web fetching or PDF tools. Therefore the packet includes selected-card names, prompts, and alt text; a local bundle supplies image bytes; text cards are an explicit fallback. A PDF generator should fetch only approved manifest URLs and embed bytes, rather than trusting that a remote link will render. A production server-side downloader also needs redirect, response-size, MIME, and network-address controls. The supplied reference does not implement a network downloader.

In the current repository, assessment pages have a same-origin CSP and explicit release inventories. Connecting a remote asset host needs deliberate implementation and tests; a URL in this kit does not change that policy. See `integration-plan.md`.

## What to evaluate

Pilot the background flow for comprehension, comfort, burden, and whether it improves the usefulness of suggestions. Review report examples for unsupported demographic claims, causal overreach, generic flattery, and symbolic “confirmation” of scores. Compare reports with and without optional context using independent reviewers. Measure enjoyment separately from factual grounding; liking a reading is not psychometric validation. Ask whether users understood the difference between scores, self-report, and symbols.

The type and color validation plan remains in `base/research-and-design.md`. No new participant study, accuracy improvement, production integration, or Cloudflare deployment is claimed by this kit.

## References

The full linked bibliography is in `sources.json`. Earlier type/color references are preserved in `base/sources.json`.


**[C01]** [Talhelm et al. (2014), rice versus wheat and psychological differences](https://pubmed.ncbi.nlm.nih.gov/24812395/). Regional interdependence findings; not individual diagnosis.

**[C02]** [Talhelm & English (2020), rice farming and tighter social norms](https://pubmed.ncbi.nlm.nih.gov/32732432/). Direct match to the rice/tightness connection; observational population evidence.

**[C03]** [Talhelm & Dong (2024), quasi-random assignment to rice and wheat farms](https://pubmed.ncbi.nlm.nih.gov/38413584/). Stronger design for this mechanism in a specific setting; still no ancestry-to-personality rule.

**[C04]** [Gelfand et al. (2011), tight and loose cultures in 33 nations](https://pubmed.ncbi.nlm.nih.gov/21617077/). Norm strength and tolerance of departures from norms.

**[C05]** [Michele Gelfand, Rule Makers, Rule Breakers, publisher page](https://www.simonandschuster.com/books/Rule-Makers-Rule-Breakers/Michele-Gelfand/9781501152931). Likely book match; identification remains tentative.

**[C06]** [Johnson (2014), development of IPIP-NEO-120](https://www.sciencedirect.com/science/article/pii/S0092656614000506). Empirical development and validation of the existing personality instrument.

**[C07]** [Carlson (1985), A double-blind test of astrology](https://www.nature.com/articles/318419a0). Historical experimental test; astrology is not used as personality evidence in this design.

**[C08]** [Hong Kong Observatory calendar conversion tables](https://www.hko.gov.hk/en/gts/time/conversion.htm). Calendar reference; 1901-2100 tables.

**[C09]** [Hong Kong Observatory 2024 conversion table](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2024e.pdf). 2024 boundary: 10 February, Dragon.

**[C10]** [Hong Kong Observatory 2025 conversion table](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2025e.pdf). 2025 boundary: 29 January, Snake.

**[C11]** [Hong Kong Observatory 2026 conversion table](https://www.hko.gov.hk/en/gts/time/calendar/pdf/files/2026e.pdf). 2026 boundary: 17 February, Horse.

**[C12]** [The Met, It is in the Cards (Catalog)](https://www.metmuseum.org/perspectives/tarot). Tarot as an artistic and reflective medium, including reinterpretations; not predictive validation.

**[C13]** [Cloudflare R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/). Use a custom domain for production public asset delivery.

**[C14]** [ECMAScript Internationalization API](https://tc39.es/ecma402/). Intl Chinese-calendar date parts; runtime support is checked rather than assumed.
