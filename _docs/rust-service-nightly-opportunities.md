# Rust 2024 to current nightly: service architecture opportunities

As-of: 2026-06-10

Scope: this document uses a production-service lens for this repository. It
covers stable Rust from 1.85.0, which shipped the 2024 edition, through the
current stable 1.96.0, plus the 1.97 beta / 1.98 nightly train and relevant
unstable features. It stack-ranks concrete opportunities for the current
Axum/Tokio service stack.

Local baseline checked:

- Workspace: `engmanager.xyz`, single Rust member `website`.
- Toolchain pin: `nightly-2026-05-08`.
- Local rustc: `rustc 1.97.0-nightly (f964de49b 2026-05-07)`.
- Current stable verified from Rust release stream: `1.96.0`, released
  2026-05-28.
- `releases.rs`: `1.97.0` is beta, scheduled stable for 2026-07-09;
  `1.98.0` is the active nightly train, scheduled stable for 2026-08-20.

## Repository technology baseline

The current service is already on edition 2024 and resolver v3:

- `Cargo.toml`: virtual workspace with `resolver = "3"`.
- `website/Cargo.toml`: `edition = "2024"`.
- Web service: Axum 0.8, Tokio multi-thread runtime, Tower HTTP middleware.
- HTTP clients: Reqwest with rustls.
- Rendering/assets: `eng-markup`, `eng-domain`, `rust-embed`, `pulldown-cmark`,
  `lightningcss`, OXC minifier/codegen/parser.
- Search: Tantivy in-memory indexes.
- Comments: SurrealDB `3.1.0-beta.3` with `kv-mem`, `kv-surrealkv`,
  `protocol-ws`, `rustls`.
- Payments: hand-rolled Stripe REST client + webhook signature verification.
- Observability: `tracing`, `tracing-subscriber`, `TraceLayer`.
- State: `AppState` with `Arc<SearchEngine>`, `Arc<CommentStore>`,
  `Arc<Checkout>`, plus `FromRef`.

Local code inventory:

- Rust LOC under `website/src`: about 8.5k.
- Largest modules: `pages/articles.rs`, `search.rs`, `pages/homepage.rs`,
  `pages/checkout.rs`, `pages/shop.rs`, `stripe.rs`, `discord.rs`,
  `build.rs`.
- Existing refactor plan already targets module split, shell/assets/components,
  search, comments, Stripe, and JS router hardening.

Notable local pressure points found during the inventory:

- `stripe.rs` mixes catalog sync CLI, runtime checkout client, webhook
  verification, and JSON event handling in one module.
- `search::SearchEngine::index_comment` locks a `std::sync::Mutex`, writes to
  Tantivy, commits, reloads, then updates metadata on the request path.
- `search` and `assets` use synchronous `std::sync::RwLock` for read-mostly
  metadata.
- Several production paths still use `eprintln!` / `println!` instead of
  structured `tracing`.
- Comments use `anyhow` for both validation and storage failures, which makes
  HTTP mapping imprecise.
- Stripe runtime responses and webhooks are mostly `serde_json::Value` indexing,
  which silently defaults missing fields in places where protocol correctness
  matters.
- Search query parsing has a custom percent-decoder, despite URL/form parsers
  already being present transitively.
- `cargo update -w --dry-run --verbose` reported no lockfile changes, but showed
  newer available packages not selected in the current resolution, including
  `tower-http 0.6.11`, `surrealdb 3.1.4`, `oxc 0.135`, `serde_json 1.0.150`,
  and major-line updates such as `reqwest 0.13`.

## Decision rubric

Rank features and refactors by:

1. Production correctness: prevents user-visible failures, security issues, data
   loss, or silent protocol drift.
2. Latency/cost: removes request-path blocking, extra allocations, rebuild cost,
   or oversized dependencies.
3. Operability: improves tracing, failure classification, deploy safety, and
   incident diagnosis.
4. Modularity: makes more similar services easy to add without copying global
   modules.
5. Readability: reduces nesting, ad hoc parsing, and "stringly typed" protocol
   code.
6. Portability: reduces platform-specific assumptions and improves deployment
   options.
7. Risk: stable Rust and well-maintained crates outrank nightly features.

Rule for nightly: use nightly because this repo pins it, but do not make service
architecture depend on unstable features unless the usage is isolated,
well-tested, and easy to delete. The highest leverage is currently in stable
Rust plus crate and architecture choices.

## Top 20 stack-ranked opportunities

| Rank | Opportunity | Leverage | Current evidence | First step | Risk |
|---:|---|---|---|---|---|
| 1 | Introduce typed service errors with `thiserror` and one HTTP error mapping layer | Correctness, readability, modularity | `comments` and `stripe` use `anyhow`/string errors across validation, dependency, and protocol failures | Add `CommentError`, `CheckoutError`, `SearchError`; implement `IntoResponse` or shared `http::json_error` mapping | Low |
| 2 | Move Tantivy comment indexing commits off the request path | Latency, scalability | `index_comment` locks a `Mutex`, adds doc, commits, reloads reader synchronously | Use `tokio::task::spawn_blocking` or a bounded `mpsc` indexing worker; return after durable comment write, then index async | Medium |
| 3 | Replace read-mostly lock hot paths with snapshot state (`ArcSwap` or owned immutable maps) | Latency, tail behavior | `search.comments: RwLock<HashMap<...>>`; `assets` URL cache uses `RwLock<HashMap<...>>` | Use `ArcSwap<HashMap<...>>` for comment metadata; consider build-time asset URL manifest to remove asset URL lock | Medium |
| 4 | Add rate limits and concurrency caps for public API routes | Abuse resistance, cost control | `/api/articles/{slug}/comments`, `/api/checkout/intent`, `/api/search/typeahead`, `/__rum` are public write/compute endpoints | Add `tower-governor` or Tower `ConcurrencyLimitLayer` per API subtree; key by Cloudflare connecting IP header when present | Medium |
| 5 | Harden outbound HTTP clients | Correctness, cost, resilience | Stripe uses `Client::new()` with no explicit timeout; Discord has a configured client | Create shared `reqwest::ClientBuilder` config: connect timeout, request timeout, user-agent, pool settings, optional retry policy at call sites | Low |
| 6 | Replace `serde_json::Value` protocol handling with typed structs and pathful decode errors | Correctness, debugging | Stripe product search, PaymentIntent response, and webhook event handling index JSON dynamically | Add typed `StripeError`, `ProductSearchResponse`, `PaymentIntentResponse`, webhook enum/structs; use `serde_path_to_error` in debug/log paths | Medium |
| 7 | Replace custom query parsing with a standard form URL parser | Correctness, readability | `pages/search.rs` contains hand-rolled `query_decode` / `query_encode` | Use `form_urlencoded` or `serde_urlencoded`; add tests for repeated `category`/`tag`, invalid UTF-8, plus signs, malformed `%` | Low |
| 8 | Enforce service-grade lints in `Cargo.toml` | Correctness, readability | Workspace relies on manual discipline; Rust 1.89 adds useful default lifetime lint, but local policy is not explicit | Add `[workspace.lints.rust]` and `[workspace.lints.clippy]`; start with non-controversial lints, then ratchet | Low |
| 9 | Use checked/strict/saturating arithmetic for request-controlled math | Correctness | Search pagination does `(page - 1) * PAGE_SIZE`; checkout totals/idempotency hash perform arithmetic from request quantities | Replace with `checked_*`/`saturating_*` or stable `strict_*` where panics are acceptable; clamp page to a sane max | Low |
| 10 | Split Stripe into `stripe/client.rs`, `checkout.rs`, `sync.rs`, `webhook.rs` | Modularity, testability | One 400+ line file mixes CLI, runtime HTTP, webhook verification, filesystem writes | Move code behind module boundaries; preserve public API from `stripe::Checkout` and `stripe::run` during migration | Low |
| 11 | Upgrade or isolate SurrealDB beta dependency | Cost, portability, dependency health | Manifest pins `surrealdb = 3.1.0-beta.3`; latest seen by Cargo is `3.1.4`; dependency tree is large | First try `surrealdb 3.1.4` in a branch; if still heavy, define `CommentRepository` and compare SQLite/sqlx for this use case | Medium |
| 12 | Add request IDs, sensitive-header marking, and richer `TraceLayer` spans | Operability, security | `TraceLayer::new_for_http()` is present, but logs are generic; auth/signature headers should never leak | Use `tower-http` request-id and sensitive-headers layers; customize trace spans with route, host, status, latency, cache policy | Low |
| 13 | Add cargo supply-chain and dependency hygiene gates | Security, maintainability | No local evidence of `cargo-deny`, `cargo-audit`, `cargo-machete`, or `nextest` config | Add `deny.toml`, audit in CI, machete in manual check, nextest for faster local/CI test feedback | Low |
| 14 | Move asset URL hashing to a generated build-time manifest | Latency, readability | Runtime `asset_url` hashes lazily and caches behind a lock; build script already owns asset discovery | Generate `$OUT_DIR/asset_manifest.rs` with stable path -> hashed URL constants/map; use `include!` | Medium |
| 15 | Parallelize and structure the build script asset pipeline | Dev speed, CI cost | `build.rs` processes CSS, JS, and component assets sequentially | Use `std::thread::scope` or `rayon` build-dep for independent files; return typed build errors before `panic!` | Medium |
| 16 | Adopt `assert_matches!` / `debug_assert_matches!` in tests | Test diagnostics | Tests often assert status/header strings; pattern failures would be clearer with value output | Import `std::assert_matches` where enum/result variants are asserted | Low |
| 17 | Use `core::range` for copyable spans and offsets | Readability, API clarity | Search snippets, article headings, quote offsets, and sitemap/date slices pass start/end style data | Use `core::range::Range<usize/u32>` in new span structs; keep public APIs accepting `impl RangeBounds` where needed | Low |
| 18 | Clean nested control flow with let chains and if-let match guards | Readability | Repo already uses some let chains; more exist in request parsing, Stripe event handling, and filters | Apply opportunistically under tests; let Clippy guide the low-risk cases | Low |
| 19 | Use trait upcasting and stable async trait patterns only at module boundaries | Modularity | `AppState` uses concrete `Arc<T>` services; future similar services may want traits | Prefer generic service traits or enums first; if `dyn` is needed, use trait upcasting for shared supertraits instead of shim methods | Medium |
| 20 | Keep nightly-only features as experiments: `gen_blocks`, `try_blocks`, RTN, async dyn traits | Future readiness | Toolchain is nightly, but no production need requires unstable syntax today | Create tiny experiments/tests only if they remove real boilerplate; do not put unstable features in the service hot path | Medium-high |

## Stable Rust features, service lens

### Rust 2024 edition, stable in 1.85

The repo is already edition 2024. The important service rules are:

- Keep `resolver = "3"` in the virtual workspace root. A virtual workspace does
  not inherit a package edition default.
- Add `+ use<>` to return-position `impl Trait` only when a helper returns an
  opaque iterator/future/closure that should not capture an input lifetime.
  This matters for helper APIs that produce iterators over static route tables,
  content metadata, or generated assets.
- Treat `if let` scrutinee and tail-expression temporary drops as earlier than
  older editions. If a lock guard or borrow must live longer, bind it with
  `let`.
- Keep unsafe code boring: `unsafe_op_in_unsafe_fn` warns by default, unsafe
  extern blocks and unsafe attributes are explicit, and references to
  `static mut` are denied. This repo should continue to avoid `unsafe` in
  service code.
- `std::env::set_var` / `remove_var` are unsafe in 2024. Runtime config should
  continue to read env at startup, not mutate process env.

Service opportunity:

```rust
fn visible_articles() -> impl Iterator<Item = &'static Article> + use<> {
    ARTICLES.iter().filter(|article| article.indexed)
}
```

Use this form when the returned iterator is intentionally independent of caller
lifetimes.

### Rust 1.85

Relevant:

- Async closures and `AsyncFn*` traits.
- `#[diagnostic::do_not_recommend]` for library APIs with blanket impls.
- `FromIterator` / `Extend` for larger tuples.

Service rule: async closures are useful in generic retry, timeout, and task
helpers that need a closure returning a future which borrows from captures. Do
not introduce them just to make ordinary Axum handlers look newer.

Potential local use:

```rust
async fn with_retry<F, T, E>(mut f: F) -> Result<T, E>
where
    F: AsyncFnMut() -> Result<T, E>,
{
    // sketch only: add policy/backoff before using
    f().await
}
```

### Rust 1.86

Relevant:

- Trait upcasting for `dyn Subtrait` to `dyn Supertrait`.
- `get_disjoint_mut` for slices and `HashMap`.

Service rule: use trait upcasting only if the architecture grows true trait
objects, for example several storage backends with a common `HealthCheck`
supertrait. Do not add dyn dispatch where concrete `AppState` services work.

Service rule: use `get_disjoint_mut` when mutating two entries of the same map
or slice, instead of split/index workarounds.

### Rust 1.87

Relevant:

- `Vec::extract_if` / `LinkedList::extract_if`.
- `usize::is_multiple_of`.
- `Vec::with_capacity` guarantees requested allocation amount.

Service rule: use `extract_if` for "remove and act on removed items" queues,
buffer cleanup, or build-script asset partitioning. Use `retain` when removed
items are discarded.

### Rust 1.88

Relevant:

- Let chains in edition 2024.
- `<[T]>::as_chunks` / `as_rchunks`.
- Cargo cache garbage collection.

Service rule: flatten nested optional extraction in request parsing, host
dispatch, and Stripe event handling with let chains when it shortens the
failure path.

Example shape:

```rust
if let Some(host) = headers.get(header::HOST)
    && let Ok(host) = host.to_str()
    && is_shop_host(host)
{
    // shop dispatch
}
```

Use `as_chunks::<N>()` for fixed-width data, such as RGB/RGBA bytes, generated
hash chunks, or structured binary payloads. It is less relevant to the current
HTML-heavy code.

### Rust 1.89

Relevant:

- `_` inferred const-generic arguments in function bodies.
- `mismatched_lifetime_syntaxes` lint warns by default.
- `Result::flatten`.
- Cross-compiled doctests now run under `cargo test --doc --target ...`.

Service rule: let the new lifetime lint make function signatures clearer. In
helpers returning borrowed iterators, prefer explicit `'_` in returned type
paths if a named return type is used.

### Rust 1.90

Relevant:

- LLD is default for `x86_64-unknown-linux-gnu`.
- Native `cargo publish --workspace`.

Service rule: keep the Linux default LLD linker. It matters for CI and deploy
build time, especially with Axum, SurrealDB, Tantivy, OXC, and proc macros in
the graph. Do not opt out unless a linker regression is proven.

### Rust 1.91

Relevant:

- Strict integer arithmetic (`strict_add`, `strict_mul`, etc.) panics on
  overflow in all profiles.
- `Duration::from_mins` / `from_hours`.
- Additional diagnostics/lints around dangling pointers.

Service rule: request-controlled arithmetic must choose a policy. For page
offsets, use `checked_*` or `saturating_*`; for invariants that should never
overflow, use `strict_*` and let tests catch it.

Local targets:

- `search.rs`: pagination start offset.
- `pages/checkout.rs`: item count and amount accumulation.
- `search.rs`: `article_date_key`.

### Rust 1.92

Relevant:

- `Box` / `Rc` / `Arc::new_zeroed` and `_slice` variants.
- `RwLockWriteGuard::downgrade`.
- Cargo build performance guide.

Service rule: use zeroed allocation APIs only for large numeric/scratch buffers
where initialization cost matters. Current service code mostly handles strings,
HTML, JSON, and indexes, so this is not a top opportunity.

`RwLockWriteGuard::downgrade` is useful if a write path updates shared state and
then wants to continue serving reads without releasing/reacquiring. If this repo
keeps `RwLock` in search metadata, downgrade is a small cleanup option.

### Rust 1.93

Relevant:

- `cargo clean --workspace`.
- `VecDeque::pop_front_if`.
- `Vec::into_raw_parts`.

Service rule: mostly tooling or niche. `pop_front_if` could be useful for a
bounded background queue, but a Tokio channel is usually the better service
primitive.

### Rust 1.94

Relevant:

- `LazyLock` / `LazyCell` accessors: `get`, `get_mut`, `force_mut`.
- Cargo config `include`.
- TOML v1.1 parsing.
- Iterator/slice improvements such as array windows.

Local status: the repo already uses `LazyLock` in `config`, `discord`,
`assets`, and article rendering.

Service rule: use `LazyLock` for immutable compute-once tables. Do not wrap a
lazy value in a lock unless it truly mutates after initialization.

Cargo config include is useful for splitting local, CI, and deploy profile
settings:

```toml
# .cargo/config.toml
include = [
  { path = "config/ci.toml", optional = true },
  { path = "config/local.toml", optional = true },
]
```

### Rust 1.95

Relevant:

- `if let` guards in `match`.
- `core::hint::cold_path()`.
- `cfg_select!`.

Service rule: use if-let guards for typed protocol/event handling when a match
arm needs a fallible extraction.

Example shape:

```rust
match event {
    StripeEvent::PaymentIntentSucceeded(intent)
        if let Some(items) = intent.metadata.items.as_deref() =>
    {
        tracing::info!(id = %intent.id, items, "payment succeeded");
    }
    other => tracing::debug!(kind = ?other.kind(), "ignored stripe event"),
}
```

Use `cold_path()` sparingly in error branches inside genuinely hot loops. It is
probably less important than removing blocking work from request paths.

Use `cfg_select!` if target-specific service code grows, for example different
listener/socket behavior on Unix vs Windows.

### Rust 1.96

Relevant:

- New `core::range` / `std::range` types that implement `Copy`.
- `assert_matches!` and `debug_assert_matches!`.
- WebAssembly undefined symbols are linker errors by default.
- Cargo fixed CVE-2026-5222 and CVE-2026-5223.
- Cargo allows a dependency to specify both git and alternate registry for
  publish workflows.

Service rule: use `assert_matches!` in tests that assert enum variants or
structured errors. It gives better failure output than `assert!(matches!(...))`.

Service rule: use new copyable range types for stored spans/offsets. Keep APIs
accepting `impl RangeBounds` when callers should be able to pass both old and
new range values.

Local target examples:

- Text quote offsets in comments.
- Search snippets.
- Markdown heading ranges.
- Asset hash or byte slices if those become structured types.

## Nightly and unstable features

The repo pins nightly, but current production opportunities should still prefer
stable features.

| Feature | Status | Service rule |
|---|---|---|
| `gen_blocks` / `gen fn` | Unstable, tracking issue `#117078` | Experiment only for local iterator-heavy helpers. Useful for route/content/search generators if it deletes a manual state machine. Do not require it for public service architecture. |
| `try_blocks` | Unstable, tracking issue `#154391` in current unstable book | Nice for local expression-level fallible assembly, such as building a response fragment from several fallible fields. Keep out of production until stable. |
| Return-type notation | Unstable, `#109417` | Relevant only if generic async service traits need to bound returned futures as `Send`. Avoid unless designing a shared framework crate. |
| `async_fn_in_dyn_trait` | Unstable, `#133119` | Do not use for this service today. Prefer concrete services, enums, or stable `async fn` in traits when dyn dispatch is not needed. |
| `type_alias_impl_trait` | Unstable, `#63063` | Library-author tool for naming hidden concrete types. Not needed for this app unless extracting a reusable crate. |
| `impl_trait_in_assoc_type` | Unstable, `#63063` | Watch for future async trait ergonomics. Avoid in app code. |
| `trait_alias` | Unstable, `#41517` | Ergonomic only. Use a real supertrait on stable if needed. |
| `generic_const_exprs` | Unstable and explicitly incomplete | Do not use in production. Use plain consts, small runtime arrays, or generated code. |
| Specialization | Unstable, soundness-blocked | Do not use. Prefer enums, trait methods, or explicit strategy types. |
| Next trait solver / Polonius / async state-machine optimization | Project goals / compiler work | Watch only. These may improve compile errors, borrowing, and async performance without app code changes. |

## Crate opportunities

These are not "add everything" recommendations. Each crate should earn its
weight against this service's small size and deployment goals.

| Crate/tool | Current/latest checked | Why it matters here | Recommendation |
|---|---:|---|---|
| `thiserror` | 2.0.18 | Typed errors without hand-written `Display`/`Error` impls | Add for service/domain errors |
| `serde_path_to_error` | 0.1.20 | JSON protocol decode errors with field paths | Add around Stripe/webhook decoding |
| `form_urlencoded` | 1.2.2 | Correct HTML form/query parsing | Use for search params or adopt `serde_urlencoded` directly |
| `arc-swap` | 1.9.1 | Lock-free read-mostly `Arc` snapshots | Consider for comment search metadata and config snapshots |
| `parking_lot` | 0.12.5 | Smaller/faster locks, no poisoning | Use only if staying lock-based; do not add where `ArcSwap` fits better |
| `tower-governor` | 0.8.0 | Tower/Axum rate limiting | Add on public write/compute API routes |
| `governor` | 0.10.4 | Lower-level rate limiting | Use directly only if middleware is not flexible enough |
| `tower-http` | 0.6.11 latest seen, repo resolved 0.6.10 | Request IDs, sensitive headers, tracing, compression, timeout | Upgrade patch if compatible; enable targeted features |
| `tracing-opentelemetry` | 0.33.0 | Export traces when local logs are not enough | Optional feature, not default dev dependency |
| `secrecy` / `zeroize` | 0.10.3 / 1.8.2 | Avoid accidental secret logging/copying | Wrap Stripe secret/webhook keys if they move beyond env strings |
| `garde` | 0.23.0 | Declarative validation | Consider for comment/checkout request validation if custom checks grow |
| `cargo-nextest` | 0.9.137 | Faster, better test runner | Add config and use in CI/local gates |
| `cargo-deny` | 0.19.8 | License/advisory/duplicate/dependency policy | Add before the dependency graph grows further |
| `cargo-audit` | 0.22.2 | Lockfile vulnerability check | Add to CI or `just audit` |
| `cargo-machete` | 0.9.2 | Detect unused dependencies | Add as periodic/manual gate |

## Refactor guidance by subsystem

### HTTP/router

Keep Axum/Tower. The current stack is appropriate.

Near-term improvements:

- Group API routes into a subtree and apply rate/concurrency limits there.
- Add request ID propagation before `TraceLayer`.
- Mark `authorization`, `cookie`, `stripe-signature`, and any future payment
  headers sensitive before tracing.
- Customize trace spans with `host`, matched route, status, latency, and
  cache-control class.
- Keep `TimeoutLayer`, but remember it is not a substitute for outbound client
  timeouts and bounded queues.

### State and concurrency

Current `AppState` with `Arc<T>` and `FromRef` is good. The next step is making
each `T` internally non-blocking for common reads.

Recommended direction:

- Comment index metadata: `ArcSwap<HashMap<String, CommentDoc>>`.
- Asset URL lookup: generated build-time manifest or immutable map.
- Discord snapshot: consider `tokio::sync::watch` instead of `LazyLock<Arc<RwLock<Option<_>>>>`
  if updates need subscriber semantics.
- Keep `std::sync::Mutex` out of async request paths unless the guarded section
  is tiny and never does I/O or CPU-heavy work.

### Search

Tantivy is a reasonable choice for this site, but request-path commit/reload is
the main risk.

Recommended direction:

- Search queries can remain synchronous if measured fast.
- Comment indexing should be queued and committed in `spawn_blocking`.
- Use typed `SearchError`.
- Clamp pagination and use checked/saturating arithmetic.
- Remove dead fields such as `title_prefix` if confirmed unused.
- Consider rebuilding an immutable in-memory search snapshot after batched
  comment writes rather than mutating live index state per comment.

### Comments

SurrealDB can work, but it is heavy for the current comment use case.

Recommended direction:

- First, upgrade from `3.1.0-beta.3` to the latest stable patch and test.
- Add a `CommentRepository` trait or concrete boundary so storage can be swapped
  without touching handlers/search.
- Convert validation failures into typed 400s and storage failures into generic
  500/503 responses.
- Decide whether comments are critical for startup. The existing refactor plan
  mentions degraded startup; implement that deliberately if desired.
- Evaluate SQLite/sqlx if portability, binary size, build time, or operational
  simplicity matters more than SurrealDB's document/query model.

### Stripe

Stripe is the highest-correctness external protocol in the repo.

Recommended direction:

- Split sync CLI from runtime checkout and webhook verification.
- Add explicit client timeouts.
- Keep raw body webhook verification exactly as-is semantically.
- Replace dynamic JSON reads with typed response/event structs.
- Include shipping fields in checkout idempotency key if the same cart/email can
  produce different shipping metadata.
- Use `tracing` with structured fields, not `println!`.
- Consider `secrecy::SecretString` for loaded keys if logs/debug output grows.

### Assets/build

The current build script is deterministic and useful, but it does runtime work
that can move to build time.

Recommended direction:

- Generate component asset constants and the asset URL manifest from `build.rs`.
- Parallelize independent CSS/JS/component minification if dev build time is a
  real pain.
- Keep output collision checks.
- Consider BLAKE3 only if hashing cost is measured meaningful; rust-embed's
  SHA-256 metadata is already available and adequate for cache keys.

### Tests/tooling

Recommended direction:

- Adopt `assert_matches!` for variant/error assertions.
- Add `cargo nextest run -p website`.
- Add `cargo deny`, `cargo audit`, and `cargo machete` as explicit tasks.
- Keep the existing router-surface tests; they are the right kind of contract
  tests for this service.
- Add a few protocol tests around Stripe event decoding and search query parsing
  before refactoring those modules.

## What not to do

- Do not add nightly `generic_const_exprs`, specialization, or dyn async traits
  to production service code.
- Do not replace Axum/Tokio/Tower for novelty. The stack is modern and suitable.
- Do not add a broad abstraction layer over every service. Add boundaries where
  there is real volatility: comments storage, Stripe client/protocol, search
  indexing.
- Do not solve latency with global allocators before measuring. A mimalloc or
  jemalloc experiment is reasonable later, but request-path blocking and large
  dependency surface are higher leverage now.
- Do not use `DashMap` reflexively for read-mostly state. Snapshot maps often
  produce simpler behavior and better read paths.

## Suggested implementation sequence

Phase 1: correctness and observability

1. Add typed errors for comments/search/checkout.
2. Replace remaining production `eprintln!` / `println!` with `tracing`.
3. Add request IDs, sensitive headers, and richer trace spans.
4. Add checked pagination and checkout arithmetic tests.
5. Replace search query parser with standard parser and tests.

Phase 2: request-path latency

1. Move Tantivy comment indexing into `spawn_blocking` or a bounded worker.
2. Convert comment metadata reads to snapshot state.
3. Add API rate/concurrency limits.
4. Add explicit outbound HTTP timeouts.

Phase 3: modularity and dependency hardening

1. Split Stripe module.
2. Upgrade or isolate SurrealDB.
3. Generate asset URL manifest at build time.
4. Add cargo-deny/audit/machete/nextest.

Phase 4: stable Rust cleanup

1. Adopt `assert_matches!` in tests.
2. Opportunistically use let chains and if-let guards where they reduce nesting.
3. Use `core::range` for new span/offset structs.
4. Add lint policy and ratchet it as the refactor stabilizes.

## Sources

Primary Rust sources:

- Rust 1.85.0 and Rust 2024:
  https://blog.rust-lang.org/2025/02/20/Rust-1.85.0/
- Rust 1.86.0:
  https://blog.rust-lang.org/2025/04/03/Rust-1.86.0/
- Rust 1.87.0:
  https://blog.rust-lang.org/2025/05/15/Rust-1.87.0/
- Rust 1.88.0:
  https://blog.rust-lang.org/2025/06/26/Rust-1.88.0/
- Rust 1.89.0:
  https://blog.rust-lang.org/2025/08/07/Rust-1.89.0/
- Rust 1.90.0:
  https://blog.rust-lang.org/2025/09/18/Rust-1.90.0/
- Rust 1.91.0:
  https://blog.rust-lang.org/2025/10/30/Rust-1.91.0/
- Rust 1.94.0:
  https://blog.rust-lang.org/2026/03/05/Rust-1.94.0/
- Rust 1.95.0:
  https://blog.rust-lang.org/2026/04/16/Rust-1.95.0/
- Rust 1.96.0 latest release:
  https://blog.rust-lang.org/releases/latest/
- Rust changelogs 1.92.0 through current beta/nightly:
  https://releases.rs/
- Edition guide, Rust 2024:
  https://doc.rust-lang.org/edition-guide/rust-2024/
- RFC 3617 precise capturing:
  https://rust-lang.github.io/rfcs/3617-precise-capturing.html
- Rust project goals:
  https://rust-lang.github.io/rust-project-goals/

Unstable/nightly sources:

- `gen_blocks`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/gen-blocks.html
- Return-type notation:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/return-type-notation.html
- `async_fn_in_dyn_trait`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/async-fn-in-dyn-trait.html
- `try_blocks`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/try-blocks.html
- `type_alias_impl_trait`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/type-alias-impl-trait.html
- `impl_trait_in_assoc_type`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/impl-trait-in-assoc-type.html
- `trait_alias`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/trait-alias.html
- `generic_const_exprs`:
  https://doc.rust-lang.org/nightly/unstable-book/language-features/generic-const-exprs.html

Crate/tool sources:

- `tower-http`: https://docs.rs/tower-http/latest/tower_http/
- `tower-governor`: https://docs.rs/tower_governor
- `governor`: https://docs.rs/governor
- `arc-swap`: https://docs.rs/arc-swap
- `thiserror`: https://docs.rs/thiserror
- `serde_path_to_error`: https://docs.rs/serde_path_to_error
- `garde`: https://docs.rs/garde
- `secrecy`: https://docs.rs/secrecy
- `zeroize`: https://docs.rs/zeroize
- `cargo-nextest`: https://nexte.st/
- `cargo-deny`: https://embarkstudios.github.io/cargo-deny/
- `cargo-audit`: https://github.com/rustsec/rustsec/tree/main/cargo-audit
- `cargo-machete`: https://github.com/bnjbvr/cargo-machete
