# Social share cards (Open Graph)

Every indexed page serves a **1200×630 JPEG** — the 1.91:1 box LinkedIn, X,
Slack, Discord and iMessage all render. Cards live in `website/assets/og/` and
are served content-addressed with `immutable; max-age=1y` like every other
asset.

| Card | Used by |
|---|---|
| `default.jpg` | the homepage, and any page with no card of its own |
| `coach.jpg` | `coach.engmanager.xyz` — the offer plus the two LinkedIn recommenders' faces |
| `article-<slug>.jpg` | each public article |
| `article-auteurs.jpg` | Auteurs, with the article's own WebGL orb and a scannable Discord QR |

## Regenerating

```bash
./scripts/generate-og.sh            # all cards
./scripts/generate-og.sh coach      # only names matching "coach"
```

Headless Chrome renders `scripts/og/card.html` — which loads the **site's own**
Monument Extended file and dark palette, so a card cannot drift from the brand.
Article copy is read from the running site's article data island, so titles,
dates and summaries cannot drift from `content.rs` either; the script boots the
dev server itself and shuts it down on exit.

Commit the output. `share_card_urls_all_resolve_to_real_assets` fails the build
if a page points at a card that was never generated.

Two non-obvious things the template has to do, both learned the hard way:

- **Request the fonts explicitly** (`document.fonts.load(...)`) before
  measuring. `document.fonts.ready` resolves immediately when nothing has asked
  for a face yet, so the headline gets measured in the fallback font — which is
  far narrower than Monument — reports two fewer lines than it renders, and the
  summary ends up printed over the byline.
- **Kill Chrome once the screenshot lands.** `--virtual-time-budget` never
  expires on a page with a `requestAnimationFrame` loop (the Auteurs orb has
  one), so Chrome writes the png and then hangs forever.

## Adding a card

Add an entry to `scripts/og/manifest.py`, rerun, commit. Then point the page at
it with `share_card(ORIGIN, "<name>")`.

`share_card` takes an origin because **scrapers never resolve a relative
`og:image`**, and the coaching page is on its own subdomain.

## What the pages emit

`MetaTags` writes `og:image` + `twitter:image`, `og:image:width`/`:height`,
`og:image:alt` + `twitter:image:alt`, `og:site_name`, `og:description` +
`twitter:description` (mirroring the page description unless overridden), and
`twitter:card: summary_large_image`.

The dimensions matter more than they look: LinkedIn will not block on
downloading an image to find out how big it is, so a card with no declared size
often renders small — or not at all on the first scrape.

## After deploying a change

Scrapers cache aggressively, and LinkedIn caches **per URL, roughly a week**.
A card that changed will keep showing the old version until it is re-scraped:

- LinkedIn — <https://www.linkedin.com/post-inspector/> (paste the URL, it
  re-scrapes immediately)
- X — <https://cards-dev.twitter.com/validator>
- Facebook/Meta — <https://developers.facebook.com/tools/debug/>

LinkedIn has no cache-purge API. If a URL is already cached wrong and the
inspector will not shift it, appending a query string (`?v=2`) gives the
scraper a new cache key.

## The Auteurs QR

Decoded from the finished JPEG with OpenCV at several render widths:

| Card rendered at | QR size | Decodes |
|---|---|---|
| 1200px (full) | 264px | yes |
| 800px | 176px | yes |
| 552px (LinkedIn desktop feed) | 121px | yes |
| 400px (small mobile render) | 88px | yes, marginal |

A phone camera does better than this — it gets continuous optics rather than a
resampled bitmap. Treat ~550px as the comfortable floor and open the image full
size if a room needs to scan it.
