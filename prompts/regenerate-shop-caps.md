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

### `real-programmers`

Use the existing `real-programmers-{view}.webp` as the edit target when refreshing this item.

- Text: `Real programmers`
- Embroidered icon under or next to text: `🧙‍♂️`, simplified as a stitched wizard if the full emoji is too detailed.
- Split phrase into two embroidered lines when needed: `Real` and `programmers`.
- Avoid: no extra words.

Generate:

- `real-programmers-front.png`
- `real-programmers-angle.png`
- `real-programmers-detail.png`
- `real-programmers-worn.png`

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
