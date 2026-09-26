# engmanager.xyz

A minimal Axum site that renders a `hello-world` component via
[`eng-markup`](https://github.com/eng-manager-xyz/auteur-rs) `view!` macros.

## Stack

- **Rust nightly** (pinned via `rust-toolchain.toml` — required by `eng-markup`)
- **Axum 0.8** + **Tokio**
- **eng-markup** — JSX-like `view!` proc-macro for HTML
- **eng-domain** — `HtmlFragment`, `Component`, `RenderValue` runtime types

## Run locally

### Plain run (no live reload)

```bash
cargo run --release
```

Visit <http://127.0.0.1:3000>. Routes:

- `GET /` → homepage
- `GET /feed` → homepage on every host
- `GET /subscribe` → newsletter signup page
- `GET /newsletter` → permanent redirect to `/subscribe`
- `POST /api/newsletter/subscribe` → server-side Kit signup, followed by a private result page
- `GET /unsubscribe?token=…` → private, inert unsubscribe page; opening the page alone never changes a subscription
- `POST /api/newsletter/unsubscribe` → validates the email's signed capability and cancels future Kit emails
- `GET /shop` → storefront on every host
- `GET /coach` → coaching on every host, including `?group=1`
- `GET /products/{slug}` → storefront product deep link on every host
- `GET /articles/` → article index
- `GET /articles/{slug}` → individual article
- `GET /articles/big-personality` → The Big Six-Seven introduction, rendered in its private assessment shell
- `GET /personality` → redirect to `/personality/prepare`
- `GET /personality/{prepare,test,review,report,share,library}` → allowlisted local-first assessment screens; unknown steps return 404
- `GET /personality/sw.js` → the assessment service worker, scoped to `/personality/`
- `GET /health` → `OK`
- `GET /coaching` → 308 to `https://coach.engmanager.xyz/`
- `GET /` on `coach.localhost:3000` → 1:1 coaching booking page
  (see `_docs/coach-subdomain-runbook.md`)

No database is required. The site runs without environment configuration;
newsletter submissions require the Kit settings below.

### Newsletter (Kit)

The website owns the signup form at `/subscribe`; Kit remains the source of
truth for subscriptions and sends confirmation emails and broadcasts.
Configure these secrets/settings in the Render service environment:

- `KIT_API_KEY`: a V4 personal-use API key for the site's Kit account.
- `KIT_FORM_ID`: the numeric ID of the newsletter form in that account.
- `NEWSLETTER_UNSUBSCRIBE_SECRET`: a dedicated random signing secret of at least
  32 bytes. A 64-character cryptographically random hexadecimal value is suitable;
  its literal UTF-8 bytes are the key. Keep it separate from the Kit API key.

Before setting the signing secret, create the Kit custom field with API key
`engmanager_unsubscribe_url`. With the secret enabled, signup writes a signed
first-party URL to that field and verifies the saved value before adding the
subscriber to the form. A failed/missing field update stops confirmation from
being triggered and presents a retryable error. New subscribers remain inactive.

For a coordinated rollout, an entirely **unset** signing secret retains the
original signup flow and leaves first-party unsubscribe unavailable. An explicitly
empty or shorter-than-32-byte secret fails closed for signup and unsubscribe.
Do not publish first-party footer links until the secret is deployed and the
field is populated for every recipient. Preserve the secret and `KIT_FORM_ID`
across deployments; changing either invalidates existing email links. Rotating a
Kit API key in the same account does not invalidate the links.

On that Kit form, enable **Send confirmation email** and disable
**Auto-confirm new subscribers**. Set the post-confirmation URL to
`https://engmanager.xyz/subscribe?status=confirmed`. Verify the sender address
in Kit before publishing a broadcast. Never commit an API key or expose it
in HTML, browser JavaScript, URLs, or logs.

New signups are created as inactive and added to the configured form.
Existing cancelled, bounced, or complained subscribers are not reactivated.
The endpoint validates email addresses, ignores honeypot submissions, and
bounds concurrent requests and API usage. Form results use `no-store` and
never include the submitted address. Missing settings leave the rest of the
site functional and show an unavailable message on signup.

For a launch check, submit a fresh address through the deployed form, follow
the confirmation email, verify its active status in Kit, then send a broadcast
to the intended recipient list and verify actual inbox receipt. Automated
tests use a local mock or a disabled integration and must never subscribe
real addresses.

#### First-party unsubscribe and existing subscribers

The email footer must have a clearly labelled **Unsubscribe** link using the
subscriber's `engmanager_unsubscribe_url` custom field. Configure confirmation,
welcome, and broadcast templates consistently; retain Kit's required unsubscribe
headers and any mandatory template elements. This route is for the visible email
link and does not replace Kit's RFC 8058 mailbox one-click POST handler.
The version-controlled [email template](website/emails/newsletter.html) matches
Kit's **ENGMANAGER — Simple** template (`5555315`). Enable it as the default only
after the deployed route and signed-field backfill are verified. Confirmation
messages must use the default template to receive the same footer. The template
retains a native Kit unsubscribe fallback when a recipient lacks the custom field;
keep Kit's survey disabled so that fallback does not add questions.

The link opens a minimal first-party page which automatically POSTs the capability
once, then shows success only after Kit returns `204`. No survey, login, or second
confirmation is required. Without JavaScript, a single Unsubscribe button performs
the same POST. GET and HEAD stay inert so ordinary link-prefetch scanners cannot
cancel a subscription; scanners that execute JavaScript can still activate the
same flow. The API cancels all future email from the Kit account, retains the
subscriber history, and never reactivates suppressed subscribers.

Before changing existing email templates, backfill the custom field for existing
intended recipients using Kit's authenticated subscriber-update API. Fetch the
current subscriber ID and email, then PUT only `email_address` plus the custom
field; do not change their state or add them to a form/sequence. Verify the returned
field equals the expected URL before marking that record complete. Keep credentials,
subscriber exports, and generated capability URLs out of Git and logs.

For interoperable administrative backfill, the URL is
`https://engmanager.xyz/unsubscribe?token=v1.<subscriber_id>.<signature>`.
`signature` is lowercase hexadecimal HMAC-SHA256 over the concatenation of:

1. UTF-8 `engmanager.xyz/kit/unsubscribe/v1` followed by one NUL byte;
2. `KIT_FORM_ID` encoded as an unsigned 64-bit big-endian integer;
3. the Kit subscriber ID encoded the same way.

Use the secret's literal UTF-8 bytes as the HMAC key. These purpose/account-form
scoped capabilities contain no email address and deliberately do not expire, so
old emails remain usable. They authorize only cancellation, not reading subscriber
data. Repeat POSTs safely request the same cancellation; provider failures remain
retryable and are never reported as success. Local mock tests cover this flow.
Per process, cancellation is limited to 20 attempts per minute and three per
recipient, while a shared budget caps actual Kit requests from both signup and
unsubscribe at 100 per minute. Limits reject honestly as temporarily unavailable;
they never reuse cached consent state or falsely claim cancellation succeeded.

#### Sending-domain authentication

In Kit's Verified Sending Domain settings, verify `engmanager.xyz` using the exact
DNS records Kit provides and add its DMARC record in Cloudflare. Preserve existing
Google Workspace MX/SPF settings. After activation, check real confirmation and
welcome messages' raw headers for aligned SPF/DKIM and DMARC pass, and confirm
both visible and mailbox unsubscribe controls remain present. A verified sender
email address alone is not equivalent to a verified sending domain.

The blog, store, and coaching share a progressive navigation shell. Near the
end of an article the store is prepared underneath it; the store leads to
coaching, and coaching leads back to the feed. Same-origin aliases keep that
journey in one document. The existing shop/store and coach subdomain roots
continue to serve their original entry points. A real change of hostname
requires a document navigation, because browser history cannot change origin.
The personality assessment and standalone checkout keep their own document
boundaries. The implementation plan and verification record are in
[`_docs/cyclic-navigation-plan.md`](_docs/cyclic-navigation-plan.md).

The personality experience uses native browser modules, embedded by Rust with
no separate Node build. The current report workflow lives under
`website/assets/personality/v7/`; it reuses the frozen scientific and sharing
modules under `website/assets/personality/v1/`.
Its route map, architecture, privacy boundaries, release rules, and verification
record are in [`_docs/big-personality/production-implementation.md`](_docs/big-personality/production-implementation.md).
The single-file prompt/evidence export and streamlined report UI are documented
in [`_docs/big-personality/report-kit-workflow.md`](_docs/big-personality/report-kit-workflow.md).
Run `npm ci --prefix scripts --ignore-scripts` followed by `npm test --prefix scripts`
for the scoring, IndexedDB, sharing, report-kit, PDF, and offline checks. Before
publishing this new presentation, run `node scripts/personality-release.mjs`
and rerun tests. The generator verifies all published v1–v6 and optional AI bytes
against their frozen inventory and writes only the v7 presentation manifest.
These are exact, versioned asset paths: an unknown filename or invented hash
returns 404. Publish changed assessment releases under a new version directory
rather than replacing an immutable release. The Rust shell contains no global
RUM, soft router, speculative preloading, remote fonts, or remote scripts. It
enforces a same-origin CSP and `Referrer-Policy: no-referrer`. Questionnaire HTML
is `no-store`; answers and reports are stored only in browser IndexedDB. The
root blog service worker bypasses the assessment and preserves its separately
scoped worker and cache namespace. Share parameters never enter the blog cache.

The v7 story editor reads existing optional details into a separate
`story-atlas-v2` note owned by the same assessment. Background answers, birthday,
and the saved tarot draw carry forward. The revised preference question has a
new item ID and needs a fresh answer; its former response and the complete v6
note remain unchanged. The 170 scientific responses, exact shared links, and
ordinary backup format keep their frozen v1 identities. V7 reuses the immutable
v6 portrait and tarot files instead of duplicating them.

### Live reload (recommended for development)

Auto-rebuild + restart on any change to `.rs` / `.toml` / `.css` / `.js` / `.svg`,
with the TCP socket held open across restarts so connections don't flap.
Mirrors the dev loop in [`auteur-rs`](https://github.com/eng-manager-xyz/auteur-rs).

**One-time install** of the tooling:

```bash
# install just (task runner)
brew install just                # macOS
# OR: cargo install just --locked

# install the dev-loop tools
just bootstrap-tools             # installs systemfd + watchexec-cli
```

**Run it**:

```bash
just dev
```

What's happening:

```
systemfd ─ holds TCP socket open ─┐
                                  ▼
                       LISTEN_FDS=1 fd 3 → cargo run (your binary)
                                  ▲
watchexec ─ on file change ───────┘ kill+restart child; same socket reused
```

Edit any source file → watchexec kills the running binary → cargo rebuilds →
the new binary inherits the listening socket from `systemfd` via the
`LISTEN_FDS` protocol (handled by the [`listenfd`](https://crates.io/crates/listenfd)
crate in `main.rs`). Restarts are sub-second once the build cache is warm.

> **Production-safety note**: the `listenfd` crate is gated behind a `dev`
> Cargo feature and is **not compiled** by `cargo build --release` (which is
> what Render runs). The live-reload plumbing has zero presence in the
> production binary — verified by checking that `cargo build --release`
> never logs `Compiling listenfd`.

**Pick a port**:

```bash
PORT=8080 just dev
```

### Production-mode bind

When `PORT` is set in the environment (without `systemfd`), the server binds
`0.0.0.0:$PORT` (production mode). Without `PORT`, it binds `127.0.0.1:3000`
(local dev mode).

## Project layout

```
engmanager.xyz/
├── Cargo.toml             # workspace + shared deps
├── Justfile               # dev-loop entry points (just dev / just check)
├── rust-toolchain.toml    # pins nightly required by eng-markup
├── scripts/               # cloudflare bootstrap + cache purge
└── website/
    ├── Cargo.toml         # binary crate
    ├── assets/            # embedded into binary via rust-embed
    │   ├── styles.css
    │   ├── favicon.svg
    │   ├── fonts/
    │   └── scripts/
    └── src/
        ├── main.rs        # router, asset handler, server bootstrap
        └── pages/
            ├── homepage.rs
            └── articles.rs
```

## Deployment (Render.com)

- Build command: `cargo build --release`
- Start command: `./target/release/website`
- Render auto-sets `PORT`, which flips the bind to `0.0.0.0`.
- Newsletter signup needs `KIT_API_KEY` and `KIT_FORM_ID`; see the setup above.

`rust-toolchain.toml` pins the nightly toolchain required by `eng-markup`/`eng-domain`
(their workspace declares `rust-version = "1.97"`, which only exists as nightly today).
Render's build runner respects `rust-toolchain.toml` and `rustup` will fetch the
pinned nightly on first build.

`eng-markup` / `eng-domain` are pulled as git dependencies from the public
[`eng-manager-xyz/auteur-rs`](https://github.com/eng-manager-xyz/auteur-rs)
repo (pinned to a specific commit in `Cargo.toml`), so the build needs
outbound HTTPS to GitHub — which Render has by default.

## Adding a component

```rust
use eng_domain::{Component, HtmlFragment};
use eng_markup::view;

struct Greeting;
struct GreetingProps { name: String }

impl Component for Greeting {
    type Props = GreetingProps;
    fn render(props: Self::Props, _: HtmlFragment) -> HtmlFragment {
        view! { <p>"Hello, " {props.name} "!"</p> }
    }
}

// Then in a handler:
let markup = view! { <Greeting name={"world".to_string()} /> };
```
