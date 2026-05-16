# engmanager.xyz

A minimal Axum site that renders a `hello-world` component via
[`eng-markup`](https://github.com/eng-manager-xyz/auteur-rs) `view!` macros.

## Stack

- **Rust** (2024 edition)
- **Axum 0.8** + **Tokio**
- **eng-markup** — JSX-like `view!` proc-macro for HTML
- **eng-domain** — `HtmlFragment`, `Component`, `RenderValue` runtime types

## Run locally

```bash
cargo run --release
```

Visit <http://127.0.0.1:3000>. Routes:

- `GET /` → `<h1>hello-world</h1>` rendered via `view! { <HelloWorld /> }`
- `GET /health` → `OK`

That's it — no database, no env vars required, no migrations.

### Optional: pick a port

```bash
PORT=8080 cargo run --release
```

When `PORT` is set, the server binds `0.0.0.0:$PORT` (production mode).
Without it, it binds `127.0.0.1:3000` (dev mode).

## Project layout

```
engmanager.xyz/
├── Cargo.toml             # workspace + shared deps
└── website/
    ├── Cargo.toml         # binary crate
    └── src/main.rs        # router, HelloWorld component, server
```

## Deployment (Render.com)

- Build command: `cargo build --release`
- Start command: `./target/release/website`
- Render auto-sets `PORT`, which flips the bind to `0.0.0.0`.
- No env vars need to be configured.

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
