# Theme typography

Source: [Figma typography compositions](https://www.figma.com/design/qVzHsCf5kWf6Q7QXz057UB/EngManager.xyz?node-id=594-177).
The canonical family/asset manifest lives in `website/src/pages/typography.rs`.
All themes share **PP Monument Extended Black** for display lettering.

| Theme | Body face | Style | WOFF2 bytes |
| --- | --- | --- | ---: |
| Light | PP Neue Montreal | Regular | 47,040 |
| Dark | PP Mori | Regular | 49,032 |
| Catppuccin | PP Editorial New | Regular | 36,792 |
| Synthwave | PP Neue Machina | Plain Regular | 50,212 |
| Cyberpunk | PP Fraktion Mono | Regular | 34,408 |
| Forest | PP Woodland | Regular | 27,372 |
| Lofi | PP Writer | Regular Text | 71,420 |
| Dracula | PP Fragment | Text Regular | 56,120 |
| Luxury | PP Eiko | Regular | 117,052 |

Auto resolves to Light or Dark and follows changes to the OS preference.
The existing responsive compositions and color palettes remain the layout system.
The guide's semantic typography roles are exposed in `critical.css`: body regular
400, leading 1.5, tracking 0, reading measure 65ch; display 900, leading 1.2,
tracking −.02em. `--font-sans` aliases the active body role for existing components;
`--font-display` is the shared heading face; `--font-mono` remains available for
code and technical annotations. Individual components retain their existing scale.
Stripe's isolated payment controls use their available system font stack.

## Loading and transitions

- The shell preloads only Monument (30,692 bytes) and Redacted (3,828 bytes).
  Theme URLs are inert JSON. No unselected body family has a CSS font-face rule.
- The synchronous theme button updates the palette before paint, then asks
  `theme-fonts.js` for the matching body face.
- A decoded in-memory face switches immediately. Otherwise the loader first checks
  Cache Storage, then the same-origin HTTP cache with `only-if-cached`. It never
  uses a persistent “loaded” flag as evidence that bytes survived eviction.
- A cached response is decoded with `FontFace.load()` while the previous readable
  face stays visible. It then swaps without Redacted or an animation.
- On a cold fetch, eagerly loaded Redacted replaces body typography and pulses.
  Once the entire WOFF2 is fetched and decoded, bars fade/blur out over 140 ms and
  the actual face enters over 220 ms. Fast loads that beat Redacted readiness
  skip the placeholder. Display text is shared and stays stable.
- Reduced motion uses the loading face without pulse, exit, or entry animation.
  Text remains in the DOM for assistive technology; the theme button stays usable.
- Requests are deduplicated. Generation checks prevent an older download or
  animation from overwriting a newer selection. Downloads time out after 12 s;
  failures restore the last readable face or system fallback and allow retry.
- Valid decoded bytes are stored in `engmanager-theme-fonts-v1`, keyed by the
  content-hashed asset URL. Disabled storage/quota errors do not block rendering.
  A font update changes its URL and therefore cannot reuse stale cached bytes.
- Soft navigation retains the controller and active font. Script-free journey
  previews receive the already decoded active face and its CSS role.

The supplied local PP TTF files were losslessly compressed with `woff2_compress`.
Google's [Redacted source](https://github.com/google/fonts/tree/main/ofl/redacted)
was compressed the same way; its OFL is included beside the font assets.

## Verification

`scripts/theme-fonts.test.mjs` covers cold/cache paths, storage denial, races,
retry, reduced motion, OS preference changes, and preview reuse.
`website/tests/typography_browser.rs` exercises actual theme-button clicks and
Chrome font decoding for all nine themes, throttled cold loads, memory and
hard-reload cache hits, rapid clicks, reduced motion, and soft navigation.
Rust tests verify every manifest asset resolves to a content-hashed URL and only
the two shared faces are preloaded.
