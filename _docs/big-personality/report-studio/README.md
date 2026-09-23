# Report Studio v1

Implemented as presentation v5 on 22 September 2026. Read the [plan written before implementation](../report-studio-plan.md). This promotes the earlier [Your Story research](../story-kit-v2/README.md) into an optional, integrated report workflow while retaining all 170 original assessment items and their scorers.

## Review the result

- [Desktop overview](desktop-overview.png), [biographical parallel](desktop-parallel.png), [mobile overview](mobile-overview.png), [figure gallery](figure-gallery.png), [color visual key](color-key.png).
- [Seven-page fictional PDF](fictional-studio-report.pdf): the actual browser print layout, with selectable text and all scores. “Alex” and every response are synthetic. This is the deterministic website report, not a claim that an external LLM wrote a report.
- [Matching Markdown kit](fictional-studio-kit.md) and [media ZIP](fictional-studio-media.zip): the writing brief, complete approved evidence, selected images, and attribution. The ZIP works without external image retrieval.
- [Figure catalog](figure-catalog.json): all 16 entries, original short summaries, editorial connections, biography sources, reusable image licenses, author credits, and hashes.
- [Verification](verification.md) and [artwork provenance](artwork.md).

## One composition, several kinds of evidence

| Movement | Tone | Content and visual slot |
| --- | --- | --- |
| A · Portrait | Warm and candid | Supported tendencies, a five-domain overview, custom color emblem |
| A′ · Patterns | Precise and grounded | Big Five facets, work interests, relative values, optional preference axes/colors |
| B · Parallels | Curious and memorable | One sourced biographical photograph and limited editorial connection |
| A″ · Working together | Practical and balanced | Helpful conditions, possible friction, participant's own words |
| C · Keepsakes | Imaginative and optional | Exact saved three-card draw and approved birthday symbols |

The same model powers the interactive report, print view, and evidence kit. The LLM brief specifies section IDs, order, word ranges, voice, typography, visual slots, source rules and verification. It permits omission of unavailable optional sections without blank pages. Exact LLM prose or pagination cannot be guaranteed across models.

The interface includes a chapter rail that becomes a horizontal mobile bar, lens filters, native detail dialogs, a 16-person gallery, a 15-combination color key, and a floating action island. Essential explanations are available through labels and controls rather than hover alone. Reduced-motion preferences are honored. The personal and working-together editions share the template; the latter omits astrology and tarot.

## Optional questions and framing

Customize opens display name, participant note, edition and export choices. The separate preference editor administers all **48 original pilot questions**, 12 per pair, or records a participant's own type code. Complete direct answers are required for each axis; means in the inclusive 2.75–3.25 band remain unresolved. The pilot is unvalidated and is not an official MBTI assessment. No type is inferred from Big Five alone. A self-selected code does not borrow pilot scores.

“Your background” administers **36 optional single/multiple-choice questions** from the earlier research bank, with a local country/territory selector. Each answer requires separate approval for print and the LLM kit. Changing it revokes that approval. Prefer-not-to-answer and unanswered fields are omitted. Background answers have no score weight: an individual's experience of rules, cooperation and belonging can inform their story; ancestry or country does not determine their personality or a cultural tightness score.

Name and participant note also require export approval. The full birthday stays in local settings; only approved symbols enter print and the kit. Chinese zodiac uses the runtime's Chinese calendar at UTC civil noon, with Lunar New Year boundaries; lack of calendar support stays unavailable. Western signs are date-range shorthand with unresolved boundary dates, not natal charts. The 78-card named placeholder deck is complete; three cards are sampled without replacement and the exact draw is retained until deliberately replaced.

## Colors and biographical parallels

Colors are a custom experimental view of eight existing facets: red E3/C4, yellow E1/E2, green A3/A6, blue C2/C6. Each score is the mean of two complete facet means. All four must be available before an emblem is selected. Colors within 0.25 raw-mean points of the highest score are emphasized; ties are retained. This provisional editorial threshold is not a validated category. Equal circle sizes and overlaps are decorative, with numeric scores separately visible.

There are **15 nonempty unordered subsets of four colors**, plus a neutral unscored ring. `scripts/personality-colors.mjs` creates all 16 SVG files. Their fixed layouts, accessible titles, translucent fill and text alternatives work on screen, in print and offline. They are not images of every possible continuous numeric score.

The finite figure catalog has one **editorial public-life parallel** for each code. It does not claim that any famous person's type is verified, that a participant has the same personality, or that fame validates a test. No politicians are typed. The catalog spans arts, science, sport and business; it is an editorial selection, not a representative global sample. The official [MBTI facts page](https://www.themyersbriggs.com/en-US/Support/MBTI-Facts) distinguishes public behavior from verified type. Wikipedia supports the short biographies; Wikimedia Commons supplies the reused photographs and license metadata. All images are packaged locally and credited in the interface, PDF and kit. No runtime third-party portrait request or generated likeness is used.

## Engineering and release

`website/assets/personality/v5/` contains the new presentation. `studio-model.mjs` is the canonical projection; `studio-view.mjs` renders screen and print; `studio.mjs` owns dialogs and lifecycle; `studio-kit.mjs` exports the composition and approved evidence. `studio-store.mjs` uses revisioned, draft-owned records in the existing notes store. Stale writes are rejected, forks start without copied settings, and assessment deletion removes owned settings. Scientific state, snapshots and old reflection records retain their contracts.

The original v1–v4 and optional AI bytes are unchanged. Frozen sharing links continue through v1; `?presentation=classic` retains v4's local AI and older workflow. Original answer backups and sharing do not acquire the new background/settings. The Markdown/media kit carries approved report context, but is not an importable settings backup.

A v5 service worker installs the full hash-verified public release only after an explicit action. The ZIP exporter checks each selected image against this manifest. Public URLs use the repository's same-origin `/assets/personality/v5/` paths and require deployment of this release; no Cloudflare upload or external bucket configuration has been performed. Attached media is preferred by the LLM brief, so PDF generation does not depend on a model having network access.

```sh
npm ci --prefix scripts --ignore-scripts
node scripts/personality-release.mjs --verify-published
node scripts/personality-studio-release.mjs
npm test --prefix scripts
CHROME_BIN=/path/to/chrome node scripts/personality-studio-browser.mjs --pdf
cargo fmt --all --check
cargo clippy -p website --all-targets -- -D warnings
REQUIRE_BROWSER_TESTS=1 CHROME_BIN=/path/to/chrome cargo test -p website
```

No frontend build is required. Playwright is a pinned development-only dependency. The standalone preview server is a local testing harness and is not a production route. After deployment, `node scripts/personality-live-smoke.mjs --expect-local` verifies the v5 shell and release inventory. This PR does not merge or deploy itself.
