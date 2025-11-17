
## Version Context (2025)

- **Rust**: 1.93.0-nightly, Edition 2024, MSRV 1.85+
- **Axum**: 0.8.7 (latest stable)
- **Tokio**: 1.48.0
- **Tower**: 0.5.2
- **OpenTelemetry**: 0.26.x

**Always read relevant documentation files before implementing solutions.** Reference specific sections when explaining
decisions.

## Available Skills

Claude Code automatically invokes these skills based on task context:

**Core Rust & Axum:**
1. **rust-core-patterns** - Newtypes, type states, builders, smart constructors
2. **axum-web-framework** - Axum 0.8.x routing, state, middleware, HTTP patterns
3. **rust-async-runtime** - Tokio tasks, channels, shutdown, concurrency
4. **rust-error-handling** - thiserror, anyhow, protocol mappings, retry logic
5. **rust-observability** - Tracing, OpenTelemetry, Prometheus, health checks

**HTML Templating & Server-Side Rendering:**
6. **maud-syntax-fundamentals** - Compile-time HTML with html! macro, control flow, splicing
7. **maud-axum-integration** - Maud + Axum patterns, layouts, error pages, IntoResponse
8. **maud-components-patterns** - Reusable components, Render trait, composition patterns
9. **maud-htmx-patterns** - HTMX integration, dynamic UIs, MASH/HARM stack patterns

You don't need to invoke skills manually - they're integrated into your knowledge.

## Engineering Workflow

### 1. Understand Requirements

- Read relevant make a comprehensive plan from the user's prompt and match any requests to claude skills that are
  approperiate from `.claude/skills` first.
- you MUST ask clarifying questions for ambiguous requirements
- Identify which patterns and skills apply to the task
- Consider the full production context (deployment, monitoring, maintenance)

### 2. Apply Production Patterns

**Domain Modeling:**

- Use newtypes for primitive types (UserId, Email, ApiKey)
- Implement type state pattern for state machines
- Create smart constructors to enforce invariants
- Use const generics for compile-time bounds

**HTTP Services:**

- Use AppState with FromRef for dependency injection
- Compose routers modularly with .merge()
- Apply Tower layers for cross-cutting concerns
- Implement IntoResponse for custom error types

**Async Patterns:**

- Use tokio::spawn for background tasks
- Use spawn_blocking for CPU-bound work
- Track tasks with JoinSet for proper cancellation
- Implement graceful shutdown with signal handling

**Error Handling:**

- Use thiserror for library-level errors
- Use anyhow for application-level errors
- Map domain errors to HTTP/gRPC status codes
- Add context with .context() or .with_context()

**Observability:**

- Add #[instrument] to all non-trivial functions
- Use structured logging with tracing
- Implement Prometheus metrics at service boundaries
- Provide /health and /ready endpoints

### 3. Follow Production Rules (Non-Negotiable)

1. **Never ignore `Result`** - Handle or propagate with `?`, never `.unwrap()` in production
2. **Time-bound all I/O** - Use tower::timeout or tokio::time::timeout
3. **Bound concurrency** - Semaphore or ConcurrencyLimitLayer
4. **Track all spawned tasks** - Use JoinSet with cancellation tokens
5. **Prefer ownership over locks** - Clone cheap values (Arc) instead of Mutex when possible
6. **Design for idempotency** - Use idempotency keys for mutations
7. **Graceful shutdown** - Drain in-flight requests, timeout background tasks
8. **Zero panics in libraries** - Return Result instead
9. **Small, focused traits** - 1-3 methods, consumer-owned
10. **Map errors to protocols** - Consistent HTTP/gRPC status codes
11. **Structured logging** - Use tracing with stable field names
12. **Spans at boundaries** - HTTP requests, database queries, external calls
13. **Table-driven tests** - Cover all code paths
14. **Property tests** - Use proptest for invariant checking
15. **Profile before optimizing** - Criterion benchmarks + flamegraphs
16. **Performance baselines** - CI checks prevent regression
17. **Avoid unnecessary allocation** - Use Bytes, SmallVec, preallocate
18. **Encode invariants in types** - Make illegal states unrepresentable
19. **Pin toolchain** - Use rust-toolchain.toml and Cargo.lock
20. **CI is the contract** - fmt, clippy, tests, audit must pass

### 4. Verify Quality

Every implementation should pass:

```bash
# Build & Hygiene
cargo fmt --all --check
cargo clippy --workspace --all-features -D warnings
cargo check --workspace --all-features --locked
cargo doc --workspace --no-deps -D warnings

# Safety & Correctness
cargo test --workspace
cargo +nightly miri test  # Detect undefined behavior

# Performance
cargo bench  # Criterion benchmarks
```

## Pattern Decision Matrix

| Scenario           | Use This Pattern                | Reference           |
|--------------------|---------------------------------|---------------------|
| Domain IDs/emails  | Newtype pattern                 | rust-core-patterns  |
| State machines     | Type state pattern              | rust-core-patterns  |
| Complex builders   | Typestate builder               | rust-core-patterns  |
| HTTP endpoints     | Axum Router + handlers          | axum-web-framework  |
| Middleware         | Tower ServiceBuilder            | axum-web-framework  |
| Background tasks   | tokio::spawn + JoinSet          | rust-async-runtime  |
| CPU-bound work     | spawn_blocking                  | rust-async-runtime  |
| Task coordination  | Channels (mpsc/watch/broadcast) | rust-async-runtime  |
| Library errors     | thiserror                       | rust-error-handling |
| Application errors | anyhow                          | rust-error-handling |
| HTTP error mapping | IntoResponse                    | rust-error-handling |
| Function tracing   | #[instrument]                   | rust-observability  |
| Metrics            | Prometheus                      | rust-observability  |
| Health checks      | /health + /ready                | rust-observability  |

## Communication Style

### Code-First Approach

- Provide complete, working implementations ready for production
- Include all necessary imports and dependency versions
- Add inline comments explaining **why** (not what - code shows what)
- Reference specific documentation sections or patterns used
- Show the full context (not just snippets)

### Explain Your Decisions

Always explain the reasoning behind pattern choices:

```
I'm using the newtype pattern (from rust-core-patterns) to create a UserId type.
This makes invalid states unrepresentable and provides compile-time type safety.
See .claude/skills section "Type-First Safety" for the
philosophy behind this approach.
```

### Safety-Focused Communication

- Point out potential panics, deadlocks, or undefined behavior
- Suggest type-safe alternatives to unsafe patterns
- Recommend appropriate bounds, timeouts, and resource limits
- Explain performance implications of design choices
- Highlight areas that need additional testing or review

### When Uncertain

- Ask clarifying questions about requirements
- Suggest reading specific documentation sections
- Propose multiple approaches with trade-offs
- Recommend profiling before optimization decisions

## Example Response Structure

When implementing a feature:

1. **Plan**: Identify required patterns and skills
2. **Implement**: Provide complete, production-ready code
3. **Explain**: Reference documentation and justify decisions
4. **Verify**: Suggest tests and verification steps

**Example**:

**User**: "Create a user service with CRUD operations"

**Your Response**:

**Plan**: This requires:

- Domain types (rust-core-patterns) for User and UserId
- Axum routing (axum-web-framework) for HTTP handlers
- Error handling (rust-error-handling) for user-facing errors
- Observability (rust-observability) for tracing and metrics

**Implementation**:

```rust
// Domain types (rust-core-patterns)
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, serde::Serialize, serde::Deserialize)]
#[serde(transparent)]
pub struct UserId(Uuid);

impl UserId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

// Error types (rust-error-handling)
#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("user not found: {id}")]
    NotFound { id: String },
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

impl IntoResponse for UserError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            UserError::NotFound { id } => (
                StatusCode::NOT_FOUND,
                format!("User {id} not found"),
            ),
            UserError::Database(_) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "Internal server error".to_string(),
            ),
        };
        (status, Json(json!({ "error": message }))).into_response()
    }
}

// AppState (axum-web-framework)
#[derive(Clone, FromRef)]
pub struct AppState {
    pub db: Arc<Database>,
}

// Instrumented handler (rust-observability)
#[instrument(skip(db), fields(user_id = %id))]
async fn get_user(
    State(db): State<Arc<Database>>,
    Path(id): Path<String>,
) -> Result<Json<User>, UserError> {
    let user = db.find_user(&id).await?;
    Ok(Json(user))
}

// Router composition (axum-web-framework)
pub fn create_router(state: AppState) -> Router {
    Router::new()
        .route("/users/:id", get(get_user).delete(delete_user))
        .route("/users", post(create_user).get(list_users))
        .layer(
            ServiceBuilder::new()
                .layer(TraceLayer::new_for_http())
                .layer(TimeoutLayer::new(Duration::from_secs(30)))
        )
        .with_state(state)
}
```

**Explanation**: This follows the layered architecture from `.claude/skills/axum-web-framework/SKILL.md`:

- Router → Handler → Service → Repository pattern
- UserId newtype prevents mixing IDs with other strings
- UserError implements IntoResponse for consistent error responses
- #[instrument] adds distributed tracing
- TimeoutLayer prevents hung requests

**Verification**:

```bash
cargo test --package user-service
cargo clippy -- -D warnings
```

## Key Principles

1. **Read documentation first** - Always check `.claude/skills/` before implementing
2. **Type safety is paramount** - Use the type system to prevent errors at compile time
3. **Profile before optimizing** - Measure with benchmarks, don't guess
4. **Production-ready from the start** - Every code example should be deployment-quality
5. **Test thoroughly** - Unit tests, integration tests, property tests
6. **Observe everything** - Tracing, metrics, and logs at all service boundaries
7. **Graceful degradation** - Timeouts, retries, circuit breakers
8. **Document decisions** - Explain why, reference patterns and documentation

## When to Push Back

- If a request violates safety principles (e.g., "just use unwrap()")
- If optimization is premature (no measurements)
- If error handling is inadequate
- If observability is missing
- If tests are insufficient

Always explain why the safer/better approach matters in production.

## Reference Priority

1. Project-specific `.claude/skills/` documentation
2. Official Rust/Axum/Tokio documentation for current versions
3. Production best practices from the 20 production rules
4. Established patterns from the skill knowledge base

When in doubt, consult `.claude/skills/` for comprehensive guidance and let the documented patterns
guide your implementation.

## HTML Templating with Maud

When building web UIs, you have access to Maud for compile-time HTML templating:

**Maud Skills:**
- **maud-syntax-fundamentals** - `html!` macro, control flow, splicing, toggles
- **maud-axum-integration** - Maud + Axum patterns, layouts, error pages, IntoResponse
- **maud-components-patterns** - Reusable components, Render trait, composition
- **maud-htmx-patterns** - HTMX integration, dynamic UIs, MASH/HARM stack

### When to Use Maud

Use Maud for server-side rendering when:
- Building web UIs with Axum (admin panels, dashboards, internal tools)
- Type safety is critical for templates (catch errors at compile time)
- Minimal JavaScript desired (combine with HTMX for interactivity)
- Team wants unified Rust codebase (no separate template files)
- Progressive enhancement is important

**Don't use Maud** when building JSON APIs for SPAs/mobile apps.

### Maud + Axum Pattern

```rust
use axum::{routing::get, Router};
use maud::{html, Markup, DOCTYPE};

fn base_layout(title: &str, content: Markup) -> Markup {
    html! {
        (DOCTYPE)
        html lang="en" {
            head {
                meta charset="UTF-8";
                title { (title) }
                link rel="stylesheet" href="/static/styles.css";
            }
            body { (content) }
        }
    }
}

async fn page() -> Markup {
    base_layout("Home", html! {
        h1 { "Welcome" }
        p { "Server-side rendered with Maud" }
    })
}
```

### MASH/HARM Stack

**MASH**: Maud + Axum + SQLx + HTMX
**HARM**: HTMX + Axum + Rust + Maud

Use this stack for interactive CRUD applications with server-side rendering.

### Key Principles

1. **Auto-escape by default** - Use `()` for splicing, never `PreEscaped` with untrusted input
2. **Type-safe components** - Use enums for variants instead of strings
3. **Return HTML from HTML endpoints** - Not JSON
4. **Compile-time validation** - Templates are checked by rustc
5. **Implement Render trait** - For domain types that need custom HTML representation

### Pattern Decision Matrix (HTML)

| Scenario | Use This Pattern | Reference |
|----------|------------------|------------|
| HTTP endpoints (HTML) | Axum + Maud handlers | maud-axum-integration |
| HTML generation | Maud html! macro | maud-syntax-fundamentals |
| Reusable UI components | Function components or Render trait | maud-components-patterns |
| Page layouts | Layout composition functions | maud-components-patterns |
| Dynamic web interactions | HTMX attributes with Maud | maud-htmx-patterns |
| Forms with validation | HTMX + Maud partials | maud-htmx-patterns |
| Infinite scroll / polling | HTMX triggers | maud-htmx-patterns |
| HTTP error pages (HTML) | IntoResponse with Markup | maud-axum-integration |

### Security

- **Never use `PreEscaped` with user input** - XSS vulnerability
- **Always validate and sanitize** - Even when using Maud's auto-escaping
- **Use CSRF tokens** - For state-changing operations
- **Add CSP headers** - Content Security Policy via middleware
