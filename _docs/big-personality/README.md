# The Big Six-Seven: research and build package

Prepared 19 September 2026 for `engmanager.xyz/articles/big-personality`.

**Recommendation:** Big Five personality plus **Work Interests** as a sixth lens and **Personal Values** as a seventh. **The Big Six-Seven** is the requested meme-inspired product name, not a claim of seven independent personality factors. The full battery contains **170 scored items**: 120 IPIP-NEO, 30 O*NET Mini-IP, and 20 TwIVI portraits. All three modules use established instruments. Original work-reflection prompts are separate optional editorial material.

## Start here

**Production implementation added:** the Rust-integrated application now lives under `website/assets/personality/v1/`, with the article at `/articles/big-personality` and the questionnaire at `/personality/prepare`. It includes 24 reviewed experiment cards selected by explicit editorial rules, ten optional local AI reflection actions, and separate storage/sharing for kept reflection text. The optional LiteRT-LM runtime lives under `website/assets/personality/ai/v1/`; its public model is downloaded separately and imported locally. Read the [implementation and verification record](production-implementation.md) for current behavior and [deployment notes](deployment-notes.md) for the release path. The older preview, requirements and enhancement proposal remain design-history artifacts. The complete local tests, optimized build, and real local-model generation have passed. Release and live verification are tracked in [PR #46](https://github.com/matthewharwood/engmanager.xyz/pull/46).

| Deliverable | What it contains |
|---|---|
| [Engineering requirements](engineering-requirements.md) | Product decisions, scientific boundaries, UX, architecture, scoring, offline, sharing, PDF, LiteRT and release criteria |
| [Printable engineering requirements](engineering-requirements.pdf) | Public 16-page version 0.3 specification and research artifact; its historical implementation status is superseded by the current implementation record |
| [Interactive design preview](design-preview.html) | Six-step journey, synthetic report, working local preview save/resume, exact preview links and audio audition controls |
| [Chart design and implementation](chart-design.md) | Original interactive SVG/CSS charts, synthetic fixture, accessible controls and scale decisions |
| [Article draft](article-draft.md) | Long-form purpose, how to answer, interpretation, the sixth/seventh lenses and privacy |

## Questions and evidence

| Deliverable | Scope |
|---|---|
| [Core questions](question-bank.md) / [JSON](question-bank.json) | 120 public-domain IPIP-NEO items; keys, five domains, 30 facets and provenance |
| [Extension questions](extension-question-bank.md) / [JSON](extension-question-bank.json) | 30 established O*NET Mini-IP activity items plus 20 established TwIVI personal-values portraits |
| [Psychometric research](psychometrics-research.md) | Core instrument evidence, scoring, norms, uncertainty and validation plan |
| [Sixth-lens research](sixth-dimension-research.md) | Why interests; alternatives including HEXACO, humility, ability and grit; personal values; licenses |
| [Snapmatch persistence review](snapmatch-persistence-review.md) | Source-level comparison: IDB hydration to reuse, remote synchronization to exclude |
| [Architecture appendix](architecture-research.md) | Actual Rust/Axum repository integration, IDB contracts, offline lifecycle, share codec and LiteRT feasibility |
| [LiteRT enhancement plan](litert-enhancement-plan.md) | Earlier proposal and evidence plan for ten capabilities; the implementation record distinguishes shipped code from untrained/unevaluated proposals |
| [Media and prompts](assets/README.md) | Two generated illustrations, two ElevenLabs sounds, generation prompts and file hashes |
| [Verification record](verification.md) | What was checked, what remains a release task |

## The central decisions

1. Preserve the established core questions. Put technology examples in a separate interpretation layer.
2. Use deterministic, versioned scoring. Personality uses keyed 1–5 means; Mini-IP uses six raw sums from 0–20; TwIVI keeps raw 1–6 means and centered within-person priorities. Do not invent population percentiles.
3. Keep the sixth lens multidimensional. Interests supply additional information; they are not statistically independent of the Big Five.
4. Measure the seventh lens directly with TwIVI, using dedicated six-option portrait responses. Never infer personal values from Big Five or interest scores. Keep original work-reflection prompts outside that measure.
5. Store answers and reports locally through `idb` / IndexedDB. Generate reports and PDFs in the browser, with optional offline files.
6. Provide three explicit share modes: selected-score summaries (`#r=`, with an opt-in public query alternative), exact selected-assessment snapshots (`#s=`), and selected answers plus actual kept reflection text and cited excerpts (`#e=`). Exact links open read-only and need no backend record or model rerun. Social previews are generic; personalized score images are generated locally.
7. Keep scientific scoring deterministic. The implemented 24-card selection rules are editorial, not a trained ranker. Optional local synthesis uses a separately installed roughly 34 MB LiteRT-LM runtime and an exact roughly 2 GB public model file imported through the browser. Ten actions help with reflection and drafts; no outcome evaluation, incremental-validity study, trained recommendation model, or claim of improved score accuracy has been produced.

## Repository-specific findings from the research phase

The research identified full-URL RUM, retained scripts during soft navigation, broad service-worker cache deletion, and permissive asset-hash fallback. The production implementation now isolates the assessment document, prevents soft navigation across that boundary, preserves separately scoped caches, and strictly serves versioned assessment paths. See the implementation record for the checks and limits.

The earlier HTML file is a design preview with working IndexedDB save/resume and self-contained links for its example answer, selections and position. Its separate `#p=` protocol carries only demo state. The production application administers all 170 items, implements `#s=` and `#e=` snapshots, and generates a personalized PDF. A kept reflection and its supporting excerpts appear in that PDF; they may contain personal details entered by the reader. Answer backups include all stored answers but omit reflection context. Separate reflection JSON includes selected answers and kept text with cited excerpts, while unused private notes remain local. The public requirements PDF is the earlier engineering specification, not a personal results report. It is copied byte-for-byte from the public document built by `scripts/build_engineering_pdf.py`; all 16 pages and companion links were checked before packaging. Synthetic report PDFs used for visual QA remain in the Git-ignored `output/pdf/personality-report-qa/` directory.

To view the design locally, run `python3 -m http.server 8765 --bind 127.0.0.1 --directory _docs/big-personality` from the repository root and visit `http://127.0.0.1:8765/design-preview.html`. Serve it over HTTP: its local ES modules do not support opening through `file://`. The preview contains no external scripts, fonts, analytics or remote storage. `idb` 8.0.3 and its license are vendored locally. Reading Markdown links is easiest in the editor.

## Provenance and remaining review

The supplied private Big Five report informed structure only. Its scores, proprietary prose, and artwork were not used as public product content; `/_docs/big5.pdf` is explicitly ignored. Generated `output/` files also remain local. The core bank documents an official-key versus paper wording discrepancy in item 58. The implementation retains the complete O*NET administration, instructions, response labels and attribution. Independent code/privacy checks have been performed, but no certification, new participant study, norm calibration, model-benefit evaluation, or public deployment is claimed here. The release PR records the final live network and exact-release verification.

Source evidence is linked beside claims in the three research appendices. Engineering budgets, participant-recruitment suggestions, editorial interpretation rules and the visual design are proposals, not research findings. Media were generated with the built-in image tool and ElevenLabs, saved in this directory, and are independent of respondents' data.
