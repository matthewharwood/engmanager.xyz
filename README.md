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
- `GET /articles/` → article index
- `GET /articles/{slug}` → individual article
- `GET /health` → `OK`

No database, no env vars required.

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
- No env vars need to be configured.

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
