# The Big Six-Seven: local model enhancement plan

Prepared 19 September 2026. **Status: researched proposal; no model is installed, trained, integrated, or benchmarked in this application.** The current report remains deterministic. This proposal extends the [production implementation](production-implementation.md), with a separately versioned enhancement layer.

The opportunity is to make the report more relevant, connected, and actionable. Questionnaire choices can directly influence model inputs, which influence selected explanations, reflection questions, and suggested experiments. Whether this produces better reports must be evaluated. It does not make the underlying personality measurement more accurate by itself.

## What LiteRT can do today

LiteRT is an inference runtime; useful behavior comes from the model weights, input design, reviewed material, and evaluation. LiteRT.js runs compatible `.tflite` models in the browser through Wasm, WebGPU, and emerging WebNN support. Its Wasm files can be self-hosted. This is a candidate for a compact relevance ranker or a compatible text encoder. Browser operator support and preprocessing still need testing for each model. [Google: LiteRT for Web](https://developers.google.com/edge/litert/web).

LiteRT-LM now also offers an **early-preview browser API**, using WebGPU for text input and output. The documented web-compatible candidates are Gemma 4 E2B and E4B in their specific web `.litertlm` formats. The API supports streaming and cancellation. These capabilities make local report composition feasible to prototype; the documentation does not establish universal browser or device compatibility. [Google: LiteRT-LM Web API](https://developers.google.com/edge/litert-lm/js).

The linked E2B model card reports a **2,008 MB web model** and approximately **1,800 MB GPU memory** in its MacBook Pro M4 Max benchmark. That benchmark excludes initial loading and cannot predict this application's performance on a typical laptop or phone. Treat it as an optional substantial download, with measured compatibility and resource requirements shown before installation. [E2B model card, Web benchmark](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/blob/main/README.md).

For this project, use two independently optional paths: a small recommendation model if it proves useful, and a larger language model for richer synthesis. The ordinary report works without either. After the necessary assets are cached, inference can stay local without a per-report cloud API charge. Storage eviction, device capacity, electricity, and distribution bandwidth remain real constraints.

## The input contract

Keep the established questionnaire, response scales, reverse coding, missing-data rules, and scoring in `core.mjs`. The 170 choices first become the same scientific scores already displayed by the application. The five personality domains, six interest dimensions, and ten value priorities remain separate constructs; the model must not imply seven independent personality factors.

For a numeric ranker, derive a versioned feature vector:

| Features | Count | Transformation for model input only |
|---|---:|---|
| Big Five facet means | 30 | `(mean - 1) / 4` |
| RIASEC interest sums | 6 | `sum / 20` |
| Within-person centered values | 10 | `centered / 4.5` |
| Completeness flags | 46 | One explicit flag for every feature above |

This gives 92 numeric inputs before optional context. Missing values can occupy a zero placeholder in the tensor only when accompanied by their completeness flag. They remain null in the scientific record and are never scored or interpreted as zero. Eligibility filters exclude cards that require missing evidence. The transforms express known scale bounds, not population norms or standardized psychological scores. Centered values are interdependent and sum to zero; do not treat them as ten independent measurements.

Five domain means are available as descriptive facts for language generation; a ranker need not duplicate them because they aggregate the facets. Preserve raw values and instrument provenance in the fact record. Give a language model labeled facts with scale explanations, rather than an unexplained array of numbers. A generic sentence encoder consumes text; it cannot meaningfully interpret our custom numeric tensor without an appropriate training objective.

Optional, explicitly answered context questions make personalization more useful:

1. What would you like help with: understanding work preferences, making work visible, collaboration, or exploring activities?
2. Which formats currently feel practical: writing, a recorded demo, one-to-one conversation, or a group discussion? Allow several and “unsure.”
3. How much time could you spend on one experiment?
4. Is there a real project or recent situation you would like to reflect on? This is optional private text.

These are unscored reflection prompts. They neither replace instrument items nor become a new validated scale. Ask preferences directly instead of inferring them from an occupation or personality score. Keep demographic attributes and hidden health, ability, political, or hiring judgments out of the personalization target.

## Ten distinct enhancements

These are ten product capabilities sharing a small number of models. They are not ten large models to download or ten mandatory generation passes. “Every report” means every report the person chooses to enhance; optional interviews, examples, comparisons, and history are used only when present.

| # | Capability | Inputs and model role | Useful output and boundary |
|---|---|---|---|
| 1 | **Whole-profile synthesis** | Complete facet, interest, and value facts; optional stated goal. A language model connects eligible reviewed explanations. | A short integrated overview with evidence links. Explain contrasting facets without declaring a contradiction, diagnosis, cause, or new personality type. Each proposed connection is a reflection hypothesis, not a validated interaction effect. |
| 2 | **Adaptive reflection interview** | Existing facts, stated goal, and previous optional answers. A model selects or drafts a small number of clarifying prompts. | Two to four useful follow-ups, such as whether the person dislikes large groups, spontaneous speaking, or both. “Does this fit?” invites correction. Keep the 170-item assessment intact; this is not computerized adaptive testing. |
| 3 | **Personal evidence mapping** | An optional project example or reflection. Text retrieval finds relevant excerpts; generation connects them to explicit report findings. | A private evidence notebook showing examples, counterexamples, and unanswered questions. Quote only exact supplied spans. The reader confirms interpretations. Never invent accomplishments or treat writing style as evidence of ability. |
| 4 | **Personal experiment selection** | Numeric profile, complete-scale masks, goal, format preference, time budget, and prior local feedback. A trained ranker orders eligible reviewed cards. | Three relevant two-week experiments from an approximately 60–100-card library, with alternatives and a reason for selection. Relevance scores are not psychological confidence or success probabilities. |
| 5 | **Visibility strategy** | Stated visibility goal, preferred format, selected experiment, and optionally a real work example. A language model adapts the plan. | A concrete way to make work legible: a debugging note, design walkthrough, small demo, or prepared contribution. The intended output is a next action and feedback signal; it does not equate extroversion with competence or promise an employment outcome. |
| 6 | **Values trade-off explorer** | Complete measured value profile and two user-described projects, activities, or environments. A language model identifies questions and missing information. | A comparison of expressed priorities, possible tensions, and questions to investigate. The user makes the choice. Do not assign a career-fit score, rank candidates, or infer undisclosed attributes of an employer. |
| 7 | **Editable “working with me” guide** | Confirmed collaboration preferences and optional examples, with relevant report facts as context. A language model drafts an artifact. | A concise guide covering feedback, focus time, decisions, and asking for help. The reader edits and explicitly approves what to share. Stated preferences take precedence over trait-based suggestions. This is a reusable communication artifact, distinct from the visibility action plan. |
| 8 | **Ask your report** | A question, the person's frozen report, and a local index of reviewed explanatory material. Retrieval supplies context to a language model. | Grounded answers to questions such as “Why was this exercise suggested?” or “How can assertiveness differ from enjoying parties?” Link claims to available evidence; acknowledge questions the report cannot answer. |
| 9 | **Longitudinal reflection** | Compatible previous local reports, dated notes, and explicit helpful/not-helpful experiment feedback. JavaScript calculates differences; a model summarizes context. | A reflection on what was reported differently and which experiments helped. Separate measurement variation, changing situations, and the person's own account. Do not label a difference statistically reliable without an applicable validated method. Local feedback conditions future selection; it is not automatic model training. |
| 10 | **Evidence and contradiction review** | Draft sections, structured facts, approved source text, and the generation contract. Deterministic checks run first; a model can flag semantic inconsistencies afterward. | Flag unsupported generalizations, invented examples, mismatched evidence, and overconfident language. Remove or fall back from flagged sections. A second model pass is an additional check, not proof of factual correctness or academic validation. |

The current implementation uses three editorial bands for each domain and the same four general experiments. The strongest initial opportunity is #1, #4, and #5, with #10 as a required validation stage. Add #2 when the report needs context. The other capabilities can be opened from the report when useful, keeping the default experience short.

### Hypothetical example

A reader's answers suggest less enjoyment of large social gatherings, comfort expressing a prepared view, strong investigative interests, and relatively greater priority for self-direction within their own values profile. They select “make my work visible” and “writing,” and describe investigating a recurring timeout.

The enhanced report could suggest:

> Try a one-page investigation note: the failure you observed, the hypotheses you tested, the evidence, and what remains uncertain. Share it with one teammate before the next design discussion. Ask which part made your reasoning easier to follow.

Show the supporting response summaries and the reader's stated preference beneath the suggestion. Do not imply that research has established this exact combination as a predictor of success. Someone with the same personality scores who chooses conversation could receive a prepared one-to-one walkthrough instead. This is where explicit context and questionnaire choices affect the output in a meaningful, inspectable way.

## Runtime and report architecture

The Rust application continues serving documents and static assets. All respondent processing remains in the browser:

```text
Local answers and optional context
  → existing deterministic scoring
  → versioned, labeled facts and missingness masks
  → hard eligibility filters over reviewed content
  → optional local retrieval / relevance ranking
  → optional bounded language generation
  → schema, score, citation, and evidence checks
  → frozen enhancement record
  → HTML report / local PDF / explicit share export
```

Use at most three bounded stages for an ordinary enhanced report: select relevant material, compose the requested sections, and review the draft. Reuse one loaded language model for those stages. Do not keep an autonomous improvement loop running in the background. The reader can cancel, retain the existing report, or request a new explicit revision.

A small numeric ranker would learn `profile + context → reviewed-card relevance`. A compatible pretrained text encoder could retrieve material for free-text goals and examples. A browser-supported language model would compose from selected facts and cards. None of these roles requires a model to calculate scores, draw charts, generate PDF primitives, or choose a random visual identity.

Proposed new modules, under a separately versioned release:

| Module | Responsibility |
|---|---|
| `features.mjs` | Stable tensor order, labeled facts, completeness masks, input limits, and feature version |
| `card-library.mjs` | Reviewed explanations and experiments, eligibility predicates, evidence requirements, and content versions |
| `model-assets.mjs` | Optional manifest, exact artifact hashes, licensing/provenance, installation, verification, and removal |
| `inference-worker.mjs` | Model lifecycle and bounded inference, if the selected SDK works in the target worker environments |
| `enhance.mjs` | Selection, composition, cancellation, validation, and deterministic fallback |
| `enhancement-store.mjs` | IDB enhancement revisions tied to the exact base report and optional context revision |
| `enhancement-share.mjs` | Strict new share schema and frozen-output rendering |

Prefer a dedicated worker to preserve interaction responsiveness, but verify the actual SDK, WebGPU, cancellation, and worker compatibility before committing to that implementation. LiteRT.js CPU support must not be mistaken for a CPU fallback in the early-preview LiteRT-LM Web API. Unsupported devices receive the ordinary report and any compatible smaller-model features.

Evaluate the minimum CSP changes needed for the chosen Wasm runtime. Keep permissions scoped to assessment routes and runtime assets. Investigate cross-origin isolation requirements only if the selected runtime needs them. Treat all optional text as data, never as permission to execute tools, load remote material, or override the evidence contract. Render output through safe text nodes or a tightly constrained document schema, never arbitrary model-generated HTML.

### Local installation and storage

The existing base offline pack is approximately 7.8 MB. Keep model packs separate. “Enhance on this device” should display actual download size, compatibility results, installation progress, cancellation, available-storage checks, and a removal action. Do not quietly add a multi-gigabyte model to the ordinary offline installer.

Self-host pinned runtime and model artifacts as static files. Large model files should be distributed separately from the Rust executable and normal source assets. Cache public immutable model bytes in an appropriate browser asset store, such as Cache Storage or OPFS after compatibility testing. Use IDB for installation metadata, report revisions, optional context, and feedback. Verify complete downloads before marking a pack installed; exercise interruption, quota exhaustion, eviction, and model hash mismatch in tests.

No answers, text, embeddings, feedback, or report content should be posted to a server. Installation requests fetch public assets only. Check this in the real browser network test. Saved enhancements remain readable after deleting the model pack. Reports tied to an older input revision must never overwrite a newer draft after an asynchronous inference job finishes.

## Exact sharing and reproducibility

The current `state.blocks` list is sorted and cannot preserve model-ranked order. The current strict v1 schema also rejects unknown fields. Introduce an explicitly supported new enhancement/share contract; keep existing v1 links readable. Do not silently change v1 interpretation or release hashes.

A frozen enhancement record should contain:

- Base report digest and schema/scoring/instrument references.
- Feature, content, model, prompt, and renderer versions, with pinned artifact digests.
- Ordered selected card IDs and their evidence references.
- Actual generated section text and references, where applicable.
- Explicit user edits and approved public excerpts, as a separate revision.
- Generation status and provenance, without exposing private local record IDs in a share URL.

**Sharing must reproduce saved output without rerunning inference.** Model version and seed alone do not ensure identical text across runtimes and devices. The receiving device should not need WebGPU or a model download to read a report.

Compact ordered-card reports can fit a versioned URL-fragment snapshot because reviewed text can be reconstructed from pinned card IDs. Generated prose must be serialized as the actual text for an exact shared version. The current full-snapshot URL budget is 8,192 characters; enforce a tested, explicit budget in any new codec. If an enhanced report exceeds it, offer a clearly labeled shorter selected-content link or a full local JSON/PDF export. Do not silently truncate or claim the abbreviated link is the complete report. Unlimited prose cannot be guaranteed to fit a practical social-media URL without introducing remote storage.

Preserve the current default of fragments for full snapshots and explicit public query sharing only for minimal score summaries. Private examples, notes, and optional interview answers are excluded by default. An enhancement preview must also reveal when generated prose itself contains such details before the person chooses to share it. Copying a link exposes its included content to whoever receives it; local inference does not make a shared URL private.

## Training and academic evaluation

There is no established pretrained “Big Six-Seven report quality” ranker in this design. A general language model can draft prose from facts, but its fluency is not evidence that it understands an individual accurately. Begin with a strong transparent rules baseline and reviewed content. Collect evidence before substituting a learned selection policy.

For the numeric ranker, the training unit is a consenting participant's profile/context plus judgments about candidate cards. Obtain expert review for unsupported claims and reader judgments for relevance and feasibility. Prefer a small regularized model over unnecessary complexity. Split train/evaluation data by person. Training on labels produced entirely by our own rules demonstrates implementation, not improvement over those rules.

All feedback stays local by default. Building a research dataset requires a separate voluntary export and clear research consent. Do not quietly turn app use into data collection. No online learning is assumed: a future research process can publish new pinned weights, while local preferences influence selection as explicit inputs.

Evaluate three conditions with blinded presentation: a strong rules report, the model-personalized report, and a shuffled-profile control. The last condition helps detect generic flattering text that readers endorse regardless of which profile produced it. Use the same underlying scores and comparable report length in the main comparison.

| Criterion | Proposed evidence |
|---|---|
| Score integrity | Byte-for-byte identical scientific score records before and after enhancement |
| Grounding | Human review of supported claims, exact example quotations, and correct evidence references; schema checks alone are insufficient |
| Relevance | Blinded reader and reviewer comparisons against the strong baseline, with results and uncertainty reported |
| Actionability | Whether the reader can name a feasible next action and later reports trying it; avoid employment-success claims |
| Robustness | Partial modules, ties, opposite facet patterns, conflicting examples, explicit preference corrections, prompt injection, and long input |
| Sensitivity | Controlled answer changes affect the relevant sections; changing only a format preference changes the proposed delivery format while scientific scores remain fixed |
| Fairness of framing | Review suggestions across varied profiles and situations; do not privilege extroversion or a particular values pattern as the desirable person |
| Runtime | Cold/warm loading, latency, memory pressure, cancellation, offline rerun, quota failure, device loss, and supported-browser matrix |
| Exact export | Read-only reconstruction of frozen selections/text in HTML and PDF without model execution; malformed, oversized, and older links handled explicitly |

Do not publish a reliability coefficient or confidence interval for an individual because a model feels certain. Do not replace uncompleted questions with predictions, invent population percentiles, assign hidden traits, or call exploratory composite patterns scientifically validated. A model critic can miss the same problem as the composing model; deterministic validation, editorial constraints, external review, and outcome testing remain necessary.

## Recommended delivery order

1. Expand the reviewed experiment library and build the versioned facts, eligibility rules, strong baseline, and frozen enhancement contract. These create value before model training.
2. Prototype optional local synthesis, experiment adaptation, and a visibility plan using one supported web language model. Benchmark installation and quality on representative hardware before deciding whether to ship it.
3. Add a compatible text encoder if retrieval quality warrants it; evaluate a learned numeric ranker once suitable relevance labels exist. Publish the comparison, including null or negative findings.
4. Add the reflection interview, examples, editable guide, and grounded Q&A when the initial report has demonstrated usefulness. Add history-based reflection after local feedback and version compatibility are established.

The intended first enhanced report contains one integrated overview, three reviewed personal experiments, and a visibility plan, with inspectable supporting facts. Every section is saved locally and remains optional. Ship only the model capabilities that improve the report enough to justify their download, latency, and complexity.
