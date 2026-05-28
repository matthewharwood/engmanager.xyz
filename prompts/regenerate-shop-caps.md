# Regenerate Shop Cap Images

Use the built-in imagegen tool once per asset below. Save each generated PNG into:

`tmp/imagegen/shop-cap-sources/{slug}-{view}.png`

Then run:

```bash
just shop-caps --sources tmp/imagegen/shop-cap-sources
```

To process a single replacement slug:

```bash
just shop-caps --sources tmp/imagegen/shop-cap-sources --slug okrs
```

## Global Constraints

- Use case: ecommerce dad-cap product mockup source for transparent WebP.
- Background: perfectly flat solid `#ff00ff` chroma-key background for background removal.
- Background must have no shadows, floor, gradient, streaks, texture, reflections, or motion lines.
- Preserve the input view's cap perspective, cap color, lighting, seams, eyelets, button, brim shape, fabric weave, person/head pose for worn views, and product-photo framing.
- Embroidery must look like raised stitched thread and must wrap to the cap crown contour. Do not place text or emoji as flat overlays.
- For angled and worn views, compress text and emoji toward the far side of the cap.
- For detail views, it is acceptable for the lower emoji/icon to be partly cropped or visually secondary.

## Assets

### `engmanager-xyz`

Use the existing `engmanager-xyz-{view}.webp` as the edit target when refreshing this item.

- Text: `ENGMANAGER.XYZ`
- Stack as three embroidered lines when possible: `ENGMANAGER`, `.XYZ`, then `🌀`.
- Embroidered icon on the third line: `🌀`, simplified as a stitched blue cyclone swirl if the full emoji is too detailed.
- Avoid: no extra words, no old single-line-only layout, no bullseye target.

Generate:

- `engmanager-xyz-front.png`
- `engmanager-xyz-angle.png`
- `engmanager-xyz-detail.png`
- `engmanager-xyz-worn.png`

### `agentic-slop`

Use the existing `agentic-slop-{view}.webp` as the edit target when refreshing this item.

- Text: `Agentic Slop`
- Embroidered icon under or next to text: `🔮`, simplified as a stitched purple crystal ball if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `Agentic` and `Slop`.
- Avoid: no extra words, no old `Backlog Zero` text.

Generate:

- `agentic-slop-front.png`
- `agentic-slop-angle.png`
- `agentic-slop-detail.png`
- `agentic-slop-worn.png`

### `css-engineer`

Use the existing `css-engineer-{view}.webp` as the edit target when refreshing this item.

- Text: `CSS Engineer`
- Embroidered icon under or next to text: `🐐`, simplified as a stitched goat head or goat silhouette if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `CSS` and `Engineer`.
- Avoid: no extra words, no old `Sprint Review` text.

Generate:

- `css-engineer-front.png`
- `css-engineer-angle.png`
- `css-engineer-detail.png`
- `css-engineer-worn.png`

### `imma-p0`

Use the existing `imma-p0-{view}.webp` as the edit target when refreshing this item.

- Text: `I'mma P0`
- Preserve the apostrophe in `I'mma` and use zero in `P0`.
- Embroidered icon under or next to text: `❄️`, simplified as a stitched white/cyan snowflake if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `I'mma` and `P0`.
- Avoid: no extra words, no old `Merge Friday` text.

Generate:

- `imma-p0-front.png`
- `imma-p0-angle.png`
- `imma-p0-detail.png`
- `imma-p0-worn.png`

### `lgtm-plus-two`

Use the existing `retro-board-{view}.webp` as the edit target.

- Text: `LGTM +2`
- Embroidered icon under text: `👌👌`
- Avoid: no old `Retro Board` text.

Generate:

- `lgtm-plus-two-front.png`
- `lgtm-plus-two-angle.png`
- `lgtm-plus-two-detail.png`
- `lgtm-plus-two-worn.png`

### `okrs`

Use the existing `okrs-{view}.webp` as the edit target when refreshing this item.

- Text: `OKRs`
- Embroidered icon under or next to text: `🎯`, simplified as a stitched target if the full emoji is too detailed.
- Avoid: no extra words.

Generate:

- `okrs-front.png`
- `okrs-angle.png`
- `okrs-detail.png`
- `okrs-worn.png`

### `ownership`

Use the existing `ownership-{view}.webp` as the edit target when refreshing this item.

- Text: `Ownership`
- Embroidered icon under or next to text: `💪🏻`, simplified as a stitched light-skin-tone flexed arm if the full emoji is too detailed.
- Avoid: no extra words, no old `Incident Commander` text.

Generate:

- `ownership-front.png`
- `ownership-angle.png`
- `ownership-detail.png`
- `ownership-worn.png`

### `real-programmer`

Use the existing `real-programmer-{view}.webp` as the edit target when refreshing this item.

- Text: `Real Programmer`
- Embroidered icon under or next to text: `🧙‍♂️`, simplified as a stitched wizard if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `Real` and `Programmer`.
- Avoid: no extra words, no old plural `Real programmers` text.

Generate:

- `real-programmer-front.png`
- `real-programmer-angle.png`
- `real-programmer-detail.png`
- `real-programmer-worn.png`

### `scrum-master`

Use the existing `scrum-master-{view}.webp` as the edit target when refreshing this item.

- Text: `Scrum Master`
- Embroidered icon under or next to text: `🗓️`, simplified as a stitched spiral calendar if the full emoji is too detailed.
- Avoid: no extra words.

Generate:

- `scrum-master-front.png`
- `scrum-master-angle.png`
- `scrum-master-detail.png`
- `scrum-master-worn.png`

### `scrum-of-scrums`

Use the existing `scrum-of-scrums-{view}.webp` as the edit target when refreshing this item.

- Text: `Scrum of Scrums`
- Embroidered icons under or next to text: `🗓️🗓️`, simplified as two stitched spiral calendars side by side if the full emoji pair is too detailed.
- Split phrase into two embroidered lines when needed: `Scrum` and `of Scrums`.
- Avoid: no extra words, no missing second calendar.

Generate:

- `scrum-of-scrums-front.png`
- `scrum-of-scrums-angle.png`
- `scrum-of-scrums-detail.png`
- `scrum-of-scrums-worn.png`

### `stakeholder`

Use the existing `stakeholder-{view}.webp` as the edit target when refreshing this item.

- Text: `Stakeholder`
- Embroidered icon under or next to text: `🥩`, simplified as a stitched steak if the full emoji is too detailed.
- Avoid: no extra words.

Generate:

- `stakeholder-front.png`
- `stakeholder-angle.png`
- `stakeholder-detail.png`
- `stakeholder-worn.png`

### `standup`

Use the existing `standup-{view}.webp` as the edit target when refreshing this item.

- Text: `Standup`
- Embroidered icon under or next to text: `🏋🏻‍♂️`, simplified as a stitched weightlifter or barbell lifter if the full emoji is too detailed.
- Avoid: no extra words, no old `Standup Club` text.

Generate:

- `standup-front.png`
- `standup-angle.png`
- `standup-detail.png`
- `standup-worn.png`

### `step-change`

Use the existing `step-change-{view}.webp` as the edit target when refreshing this item.

- Text: `Step Change`
- Embroidered icon under or next to text: `🪜`, simplified as a stitched ladder if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `Step` and `Change`.
- Avoid: no extra words, no old `Release Train` text.

Generate:

- `step-change-front.png`
- `step-change-angle.png`
- `step-change-detail.png`
- `step-change-worn.png`

### `time-check`

Use the existing `ship-it-{view}.webp` as the edit target.

- Text: `Time Check`
- Embroidered icon under text: the time-out hand gesture from the reference image, simplified as one horizontal hand over one vertical hand forming a T, with pink fingernails.
- Avoid: no old `Ship It` text, no clock emoji.

Generate:

- `time-check-front.png`
- `time-check-angle.png`
- `time-check-detail.png`
- `time-check-worn.png`

### `tokenmaxxing`

Use the existing `tokenmaxxing-{view}.webp` as the edit target when refreshing this item.

- Text: `Tokenmaxxing`
- Embroidered icon under or next to text: `💸`, simplified as a stitched green bill with small wings if the full emoji is too detailed.
- Avoid: no extra words, no old `Scope Creep` text.

Generate:

- `tokenmaxxing-front.png`
- `tokenmaxxing-angle.png`
- `tokenmaxxing-detail.png`
- `tokenmaxxing-worn.png`

### `violently-aligned`

Use the existing `violently-aligned-{view}.webp` as the edit target when refreshing this item.

- Text: `Violently Aligned`
- Embroidered icon under or next to text: `⚔️`, simplified as stitched crossed swords if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `Violently` and `Aligned`.
- Avoid: no extra words, no old `Consensus Builder` text.

Generate:

- `violently-aligned-front.png`
- `violently-aligned-angle.png`
- `violently-aligned-detail.png`
- `violently-aligned-worn.png`

### `velocity`

Use the existing `velocity-{view}.webp` as the edit target.

- Text: keep `Velocity`
- Embroidered icon under text: small wind puff `💨`, simplified as a light white/blue stitched puff.
- Avoid: do not change the word `Velocity`.

Generate:

- `velocity-front.png`
- `velocity-angle.png`
- `velocity-detail.png`
- `velocity-worn.png`

### `up-and-to-the-right`

Use the existing `wip-limit-{view}.webp` as the edit target.

- Text: `Up & to the Right`
- Split the phrase into two embroidered lines when needed: `Up & to` and `the Right`.
- Embroidered icon under text: chart increasing `📈`, simplified as a stitched chart box with a green rising line.
- Avoid: no old `WIP Limit` text.

Generate:

- `up-and-to-the-right-front.png`
- `up-and-to-the-right-angle.png`
- `up-and-to-the-right-detail.png`
- `up-and-to-the-right-worn.png`
