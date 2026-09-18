# Runbook: `coach.engmanager.xyz`

1:1 coaching booking page for early-career engineers, designers, and design
engineers. Same Render service and host-aware routing as the shop
(see `shop-subdomain-runbook.md`, "Path A").

## Architecture

```
coach.engmanager.xyz (Rust page, shop UI)
  └─ booking sheet embeds → Google Calendar appointment schedule
                              ├─ live Friday availability
                              ├─ "Require payment when booking" → Stripe checkout
                              └─ confirmed event + Meet link on both calendars
  └─ step 3: Icebreakers doc  → docs.google.com/document/d/<id>/copy
```

The binary does **not** schedule or charge anything. Google Calendar owns
availability and hands payment to the connected Stripe account; Google never
stores card data and does not issue refunds (refunds happen in Stripe).

Source of truth for the offer: `website/src/coaching.rs` (`OFFER`,
`PERSONAS`, the intake doc id). The Google schedule must match it:

| Setting              | Value                                    |
| -------------------- | ---------------------------------------- |
| Appointment duration | 35 minutes                               |
| General availability | Fridays, 10:00am – 2:00pm                 |
| Time zone            | (GMT-07:00) Pacific Time — Los Angeles   |
| Buffer time          | none (`buffer_minutes: 0` → 6 slots)     |
| Payment              | Require payment when booking · $100 USD  |
| Location             | Google Meet video conferencing           |

If you add a buffer in Google, update `buffer_minutes` in `coaching.rs` so the
"Starts" row on the page stays accurate (a test covers the 25-minute case).

## 1. Google Calendar appointment schedule (engmanager.xyz Workspace account)

Paid bookings need an eligible **Google Workspace** plan (Workspace Individual,
Business Standard/Plus, Enterprise, Education, Nonprofits). A personal
`@gmail.com` account and Business Starter cannot require payment.

1. calendar.google.com (signed in as `matthew@engmanager.xyz`) →
   **Settings → General → Appointment schedules → Connect Stripe** and
   authorize the business Stripe account.
2. **Create → Appointment schedule**:
   - Title: `1:1 Coaching · engmanager.xyz`
   - Duration: 35 minutes; availability: Fridays 10:00am–2:00pm; time zone
     Pacific Time.
   - **Payments & cancellation policy → Require payment when booking** →
     `100` `USD`.
   - Location: Google Meet.
   - Description (shows on the booking page *and* in every confirmation /
     calendar invite — this is what enforces the "after booking" step):

     > Before we meet: duplicate the Icebreakers doc, fill it out, and reply
     > to your confirmation email with the link:
     > https://docs.google.com/document/d/1uTPB3l9oJ5rCKHiqUYOv_EKfcrtLNUtKn6hIBO-Lbn8/copy
3. Save → **Share → Website embed → Inline calendar**. Copy the iframe
   `src` — it looks like
   `https://calendar.google.com/calendar/appointments/schedules/AcZssZ…?gv=true`.

## 2. Wire the booking URL into the site

Either (preferred, no deploy needed):

- Render → `engmanager-xyz` → **Environment** →
  `COACH_BOOKING_URL=https://calendar.google.com/calendar/appointments/schedules/AcZssZ…`

or bake it in: set `DEFAULT_BOOKING_URL` in `website/src/coaching.rs` and
ship a PR.

Only `https://calendar.google.com/calendar/appointments/schedules/<id>` (framed)
and `https://calendar.app.google/<id>` (link-out only) are accepted. Anything
else is logged at startup and the page shows "calendar is being connected".

## 3. Domain: Render + Cloudflare

```bash
RENDER_API_KEY=... RENDER_SERVICE_ID=srv_... \
  ./scripts/render-shop-domain.sh coach.engmanager.xyz
CF_API_TOKEN=... ./scripts/cloudflare-bootstrap.sh
```

Dashboard equivalents:

- Render → service → **Settings → Custom Domains → Add** `coach.engmanager.xyz`.
- Cloudflare → `engmanager.xyz` → **DNS → Add record**: `CNAME` `coach` →
  `engmanager-xyz.onrender.com`, **Proxied**.
- Back in Render, click **Verify** until TLS shows issued.

The bootstrap script also adds a Cloudflare cache rule for
`coach.engmanager.xyz/` that respects the origin's
`public, max-age=60, s-maxage=3600` header.

## 4. Verify

```bash
./scripts/smoke-coach.sh
```

It checks the apex `/coaching` 308, the page contract on the live subdomain,
that the Google booking page answers, and that the Icebreakers `/copy` link
resolves. Then do one real booking end to end (Google has no Stripe test
mode for appointment payments): book a slot, pay $100, confirm the event lands
on the calendar with a Meet link and the payment shows in Stripe → Payments,
then refund it from Stripe.

## Group sessions (`?group=1`)

One control above the CTA — "Who is coming?" — with two options, defaulting to
**Just me**. It is deliberately NOT a new product:

- same Google appointment schedule, same $100, same 35 minutes;
- **one person books and pays**, then forwards the Google Meet invite from
  their confirmation email to whoever they want in the room;
- nothing in Google Calendar or Stripe needs to change to support it.

This is not split-the-bill and must never imply that it is. Stripe has no
multi-payer primitive, and Google's appointment schedule charges the booker at
booking time. `the_disclaimer_never_promises_a_split_payment` pins the wording.

`SessionMode` (in `coaching.rs`) owns every difference: headline, kicker, CTA
label, page title, meta description and share card. Group mode changes the
copy, never the terms.

**The switch is two anchors, not buttons.** `/` and `/?group=1` are both
server-rendered in full, so it works with JavaScript off, the back button
behaves, and — the reason it matters — a shared `?group=1` link posts the group
title, the group description and `og/coach-group.jpg`. That is what makes "the
verbiage changes for social posting" true rather than a client-side illusion.

Canonical always points at `/`: one page with two framings, not two pages to be
indexed.

The disclaimer appears twice — on hover/focus of the ⓘ next to the switch (pure
CSS, `:hover` + `:focus-within`, so touch works by tapping the button), and
printed in full at the top of the booking sheet. The second one is not
optional: the moment money is about to change hands is not the moment to hide
the terms.

If you later want real seat pricing (solo $100 / pair $150 / group $240),
create extra Google appointment schedules and widen `BookingPage` to a list —
about a day's work, and still no database.

## Social proof: the LinkedIn recommendations

`TESTIMONIALS` in `website/src/coaching.rs` holds the two recommendations the
page quotes. LinkedIn has no permalink for a single recommendation, so:

- the recommender's **name** links to their own profile — that is the part a
  skeptical reader can actually check;
- **"Read … on LinkedIn"** links to
  `linkedin.com/in/matthewcharwood/details/recommendations/`, which is behind
  LinkedIn's login wall for logged-out visitors. That is why the quote is on
  the page in full, not teased.

House rules, enforced by `testimonials_stay_attributable_and_verbatim`:

- **Quotes are verbatim.** Trim whole sentences from the end or nothing — never
  reword, never stitch fragments with an ellipsis.
- **`takeaway` is my line, not theirs.** It renders as the card's `<h3>`,
  outside the `<blockquote>`, and is never in quotation marks.
- **No invented ratings.** The schema.org `Review` markup deliberately omits
  `reviewRating`; a LinkedIn recommendation has no stars, and Google excludes
  self-serving reviews from rich results anyway.

### Headshots

Both people agreed to their name, photo, school, and quote appearing here.

The photos are **self-hosted**, not hotlinked: `website/assets/coach/<slug>.webp`,
192×192, EXIF stripped, ~6 KB each. They ship inside the binary and are served
content-addressed (`/assets/coach/<slug>.<hash>.webp`, `immutable; max-age=1y`)
through Cloudflare's edge like every other asset. Nothing external can expire
or go away, which is the whole point.

Never point `photo` at `media.licdn.com`. Those URLs are signed and expire, and
hotlinking them breaks both the page and LinkedIn's terms. Two tests enforce
this: one rejects any `photo` that starts with `http`, and
`every_headshot_is_a_real_embedded_asset` fails if the path does not resolve to
embedded bytes (`asset_url` silently falls back to a flat, unhashed URL when a
file is missing — that fallback is what the test catches).

In the markup the monogram is always rendered *underneath* the photo, so a
failed image shows initials instead of a broken-image icon. No JS, no `onerror`.

To add or replace one:

```bash
magick <source> -auto-orient -strip \
  -resize '192x192^' -gravity center -extent 192x192 \
  -quality 82 -define webp:method=6 \
  website/assets/coach/<slug>.webp
```

Then set `photo: Some("coach/<slug>.webp")` and keep `AVATAR_PX` in
`pages/coach.rs` in sync with `--coach-avatar` in `coach.css`.

The author avatar (`pages/mod.rs`) uses Cloudflare Images instead, which buys
`format=auto` and `w=` variants. These two are small and fixed-size, so the
extra moving part is not worth it; moving them later is a one-line change per
person once someone has a `CF_API_TOKEN` handy.

If someone asks to be removed, delete their entry from `TESTIMONIALS` and ship.

## Tests

- `cargo test -p website` runs:
  - unit tests in `coaching.rs`, `pages/coach.rs`, `config.rs`, `router.rs`;
  - `tests/coach_e2e.rs` — boots the compiled binary and exercises the page,
    assets, headers, host routing, and the invalid-URL guard over real HTTP;
  - `tests/coach_browser.rs` — headless Chrome runs `coach.js` against the
    binary (speed reader boot, `?role=` spectrum deep link, booking sheet
    steps, lazy embed). Skips without
    Chrome locally; CI sets `REQUIRE_BROWSER_TESTS=1` so it cannot skip.
- CI: `.github/workflows/ci.yml` (fmt, clippy `-D warnings`, tests) on every PR
  and push to `main`.
