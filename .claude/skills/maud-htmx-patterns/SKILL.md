---
name: maud-htmx-patterns
description: Server-side rendering patterns combining Maud templates with HTMX for dynamic web interactions. Covers HTMX attributes, partial rendering, form submissions, infinite scroll, polling, WebSocket fallbacks, and MASH/HARM stack patterns. Use when building interactive server-rendered UIs, creating SPAs without JavaScript frameworks, or implementing hypermedia-driven applications.
---

# Maud + HTMX Patterns

*Production patterns for building interactive server-side rendered applications with Maud and HTMX*

## Version Context
- **Maud**: 0.27.0
- **HTMX**: 2.0.0+
- **Axum**: 0.8.7
- **Stack**: MASH (Maud + Axum + SQLx + HTMX) / HARM (HTMX + Axum + Rust + Maud)

## When to Use This Skill

- Building interactive web UIs without heavy JavaScript frameworks
- Creating SPAs with server-side rendering
- Implementing dynamic forms and updates
- Building real-time features (polling, server-sent events)
- Implementing infinite scroll, lazy loading
- Creating CRUD interfaces with minimal client-side code
- Building hypermedia-driven applications

## Core Philosophy

**HTMX enables:**
1. Server-side rendering with client-side interactivity
2. HTML fragments as API responses (not JSON)
3. Progressive enhancement
4. Minimal JavaScript
5. Simplified state management (server is source of truth)

## Setup

### Include HTMX in Layout

```rust
use maud::{html, Markup, DOCTYPE};

fn base_layout(title: &str, content: Markup) -> Markup {
    html! {
        (DOCTYPE)
        html lang="en" {
            head {
                meta charset="UTF-8";
                meta name="viewport" content="width=device-width, initial-scale=1.0";
                title { (title) }
                link rel="stylesheet" href="/static/styles.css";

                // HTMX 2.0
                script src="https://unpkg.com/htmx.org@2.0.0" {}

                // Optional: HTMX extensions
                // script src="https://unpkg.com/htmx.org@2.0.0/dist/ext/ws.js" {}
            }
            body {
                (content)
            }
        }
    }
}
```

## HTMX Attributes in Maud

### Basic HTMX Attributes

```rust
html! {
    // GET request on load
    div hx-get="/api/data" hx-trigger="load" {
        "Loading..."
    }

    // POST request on click
    button hx-post="/api/action" hx-swap="outerHTML" {
        "Click Me"
    }

    // DELETE with confirmation
    button
        hx-delete="/users/123"
        hx-confirm="Are you sure?"
        hx-target="#user-list"
    {
        "Delete User"
    }
}
```

### Common HTMX Patterns

```rust
// Load content on page load
div hx-get="/partials/sidebar" hx-trigger="load" {}

// Swap strategy
button hx-post="/action" hx-swap="innerHTML" {}  // Replace inner content
button hx-post="/action" hx-swap="outerHTML" {}  // Replace element itself
button hx-post="/action" hx-swap="beforebegin" {}  // Insert before
button hx-post="/action" hx-swap="afterend" {}  // Insert after

// Target selection
button hx-post="/action" hx-target="#result" {}
button hx-post="/action" hx-target="closest .container" {}
button hx-post="/action" hx-target="next .card" {}

// Triggers
div hx-get="/data" hx-trigger="click" {}
div hx-get="/data" hx-trigger="mouseenter" {}
div hx-get="/data" hx-trigger="every 2s" {}  // Polling
input hx-post="/search" hx-trigger="keyup changed delay:500ms" {}
```

## Patterns and Use Cases

### 1. Dynamic Content Loading

```rust
use axum::{routing::get, Router};
use maud::{html, Markup};

// Initial page
async fn page() -> Markup {
    html! {
        h1 { "Dashboard" }
        div #stats hx-get="/partials/stats" hx-trigger="load" {
            p { "Loading stats..." }
        }
    }
}

// Partial endpoint
async fn stats_partial(State(db): State<Arc<Database>>) -> Markup {
    let stats = db.get_stats().await;

    html! {
        div.stats-grid {
            div.stat-card {
                h3 { "Users" }
                p.stat-value { (stats.user_count) }
            }
            div.stat-card {
                h3 { "Posts" }
                p.stat-value { (stats.post_count) }
            }
        }
    }
}

fn router() -> Router {
    Router::new()
        .route("/dashboard", get(page))
        .route("/partials/stats", get(stats_partial))
}
```

### 2. Form Submission with Validation

```rust
use axum::{extract::Form, http::StatusCode};
use serde::Deserialize;

#[derive(Deserialize)]
struct CreateUserForm {
    name: String,
    email: String,
}

// Initial form
async fn user_form() -> Markup {
    html! {
        form
            hx-post="/users"
            hx-target="#form-container"
            hx-swap="outerHTML"
        {
            (user_form_fields(None, None))
            button type="submit" { "Create User" }
        }
    }
}

// Form fields (reusable)
fn user_form_fields(
    errors: Option<&ValidationErrors>,
    values: Option<&CreateUserForm>,
) -> Markup {
    html! {
        div.form-group {
            label for="name" { "Name" }
            input
                type="text"
                name="name"
                id="name"
                value=[values.map(|v| v.name.as_str())];
            @if let Some(errs) = errors {
                @if let Some(err) = errs.name {
                    span.error { (err) }
                }
            }
        }
        div.form-group {
            label for="email" { "Email" }
            input
                type="email"
                name="email"
                id="email"
                value=[values.map(|v| v.email.as_str())];
            @if let Some(errs) = errors {
                @if let Some(err) = errs.email {
                    span.error { (err) }
                }
            }
        }
    }
}

// POST handler
async fn create_user(
    State(db): State<Arc<Database>>,
    Form(form): Form<CreateUserForm>,
) -> Result<Markup, (StatusCode, Markup)> {
    // Validate
    if let Err(errors) = validate_user(&form) {
        return Err((
            StatusCode::BAD_REQUEST,
            html! {
                form
                    hx-post="/users"
                    hx-target="#form-container"
                    hx-swap="outerHTML"
                {
                    (user_form_fields(Some(&errors), Some(&form)))
                    button type="submit" { "Create User" }
                }
            }
        ));
    }

    // Create user
    let user = db.create_user(&form.name, &form.email).await.map_err(|_| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            html! {
                div.error { "Failed to create user" }
            }
        )
    })?;

    // Return success message
    Ok(html! {
        div.success {
            p { "User created successfully!" }
            a href="/users" { "View all users" }
        }
    })
}
```

### 3. CRUD Operations

```rust
// List with inline actions
async fn todo_list(State(db): State<Arc<Database>>) -> Markup {
    let todos = db.get_todos().await;

    html! {
        div #todo-list {
            h2 { "Todo List" }
            ul {
                @for todo in todos {
                    (todo_item(&todo))
                }
            }
            form
                hx-post="/todos"
                hx-target="#todo-list"
                hx-swap="outerHTML"
            {
                input
                    type="text"
                    name="text"
                    placeholder="New todo...";
                button type="submit" { "Add" }
            }
        }
    }
}

fn todo_item(todo: &Todo) -> Markup {
    html! {
        li #{"todo-" (todo.id)} {
            input
                type="checkbox"
                checked[todo.completed]
                hx-post={"/todos/" (todo.id) "/toggle"}
                hx-target={"#todo-" (todo.id)}
                hx-swap="outerHTML";

            span[todo.completed] { (todo.text) }

            button
                hx-delete={"/todos/" (todo.id)}
                hx-target={"#todo-" (todo.id)}
                hx-swap="outerHTML swap:1s"
                hx-confirm="Delete this todo?"
            {
                "Delete"
            }
        }
    }
}

// Toggle handler
async fn toggle_todo(
    State(db): State<Arc<Database>>,
    Path(id): Path<u64>,
) -> Result<Markup, AppError> {
    let todo = db.toggle_todo(id).await?;
    Ok(todo_item(&todo))
}

// Delete handler
async fn delete_todo(
    State(db): State<Arc<Database>>,
    Path(id): Path<u64>,
) -> Result<StatusCode, AppError> {
    db.delete_todo(id).await?;
    Ok(StatusCode::OK)  // HTMX will remove the element
}

// Create handler
async fn create_todo(
    State(db): State<Arc<Database>>,
    Form(form): Form<CreateTodoForm>,
) -> Result<Markup, AppError> {
    db.create_todo(&form.text).await?;

    // Return the updated list
    todo_list(State(db)).await
}
```

### 4. Search with Debouncing

```rust
async fn search_page() -> Markup {
    html! {
        div {
            h1 { "Search" }
            input
                type="search"
                name="q"
                placeholder="Search..."
                hx-get="/search/results"
                hx-trigger="keyup changed delay:500ms"
                hx-target="#search-results";

            div #search-results {
                p.text-muted { "Start typing to search..." }
            }
        }
    }
}

async fn search_results(
    State(db): State<Arc<Database>>,
    Query(params): Query<SearchQuery>,
) -> Markup {
    if params.q.is_empty() {
        return html! {
            p.text-muted { "Start typing to search..." }
        };
    }

    let results = db.search(&params.q).await;

    if results.is_empty() {
        return html! {
            p { "No results found for \"" (params.q) "\"" }
        };
    }

    html! {
        ul.search-results {
            @for result in results {
                li {
                    a href={"/posts/" (result.id)} {
                        strong { (result.title) }
                        p { (result.excerpt) }
                    }
                }
            }
        }
    }
}
```

### 5. Infinite Scroll

```rust
async fn posts_page() -> Markup {
    html! {
        div {
            h1 { "Posts" }
            div #posts {
                (posts_partial(1))
            }
        }
    }
}

fn posts_partial(page: u32) -> Markup {
    let posts = fetch_posts(page, 10);
    let has_more = posts.len() == 10;

    html! {
        @for post in posts {
            article.post {
                h2 { (post.title) }
                p { (post.excerpt) }
            }
        }

        @if has_more {
            div
                hx-get={"/posts/page/" (page + 1)}
                hx-trigger="intersect once"
                hx-swap="afterend"
            {
                p { "Loading more..." }
            }
        }
    }
}

async fn posts_page_handler(Path(page): Path<u32>) -> Markup {
    posts_partial(page)
}
```

### 6. Polling for Updates

```rust
// Auto-refresh every 5 seconds
async fn live_dashboard() -> Markup {
    html! {
        div
            #dashboard
            hx-get="/dashboard/refresh"
            hx-trigger="every 5s"
            hx-swap="innerHTML"
        {
            (dashboard_content())
        }
    }
}

async fn dashboard_content() -> Markup {
    let stats = fetch_current_stats();

    html! {
        div.stats {
            div.stat {
                h3 { "Active Users" }
                p.value { (stats.active_users) }
            }
            div.stat {
                h3 { "Requests/min" }
                p.value { (stats.requests_per_min) }
            }
            p.updated { "Last updated: " (stats.timestamp) }
        }
    }
}
```

### 7. Modal Dialog Pattern

```rust
// Trigger
fn trigger_button() -> Markup {
    html! {
        button
            hx-get="/modal/user-profile/123"
            hx-target="body"
            hx-swap="beforeend"
        {
            "View Profile"
        }
    }
}

// Modal endpoint
async fn user_modal(Path(user_id): Path<u64>) -> Markup {
    let user = fetch_user(user_id).await;

    html! {
        div.modal-overlay {
            div.modal {
                div.modal-header {
                    h2 { (user.name) }
                    button.close hx-on:click="this.closest('.modal-overlay').remove()" {
                        "×"
                    }
                }
                div.modal-body {
                    p { "Email: " (user.email) }
                    p { "Role: " (user.role) }
                }
                div.modal-footer {
                    button hx-on:click="this.closest('.modal-overlay').remove()" {
                        "Close"
                    }
                }
            }
        }
    }
}
```

### 8. Multi-Step Form

```rust
// Step 1
async fn signup_step1() -> Markup {
    html! {
        form
            hx-post="/signup/step2"
            hx-target="#form-container"
            hx-swap="innerHTML"
        {
            h2 { "Step 1: Basic Info" }
            input type="text" name="name" placeholder="Name" required;
            input type="email" name="email" placeholder="Email" required;
            button type="submit" { "Next" }
        }
    }
}

// Step 2
async fn signup_step2(Form(step1): Form<Step1Data>) -> Markup {
    html! {
        form
            hx-post="/signup/step3"
            hx-target="#form-container"
            hx-swap="innerHTML"
        {
            h2 { "Step 2: Preferences" }
            // Hidden fields from step 1
            input type="hidden" name="name" value=(step1.name);
            input type="hidden" name="email" value=(step1.email);

            select name="role" {
                option value="user" { "User" }
                option value="admin" { "Admin" }
            }
            button type="button" hx-get="/signup/step1" { "Back" }
            button type="submit" { "Next" }
        }
    }
}

// Final step
async fn signup_step3(Form(data): Form<SignupData>) -> Result<Markup, AppError> {
    create_user(data).await?;

    Ok(html! {
        div.success {
            h2 { "Account Created!" }
            p { "Welcome, " (data.name) "!" }
            a href="/dashboard" { "Go to Dashboard" }
        }
    })
}
```

### 9. File Upload with Progress

```rust
async fn upload_form() -> Markup {
    html! {
        form
            hx-encoding="multipart/form-data"
            hx-post="/upload"
            hx-target="#upload-result"
        {
            input type="file" name="file";
            button type="submit" { "Upload" }
            div #upload-result {}
        }
    }
}

async fn handle_upload(
    mut multipart: Multipart,
) -> Result<Markup, AppError> {
    while let Some(field) = multipart.next_field().await? {
        let name = field.name().unwrap_or("").to_string();
        let data = field.bytes().await?;

        // Process file...
    }

    Ok(html! {
        div.success {
            p { "File uploaded successfully!" }
        }
    })
}
```

### 10. Optimistic Updates

```rust
fn todo_item_optimistic(todo: &Todo) -> Markup {
    html! {
        li #{"todo-" (todo.id)} {
            input
                type="checkbox"
                checked[todo.completed]
                hx-post={"/todos/" (todo.id) "/toggle"}
                hx-target={"#todo-" (todo.id)}
                hx-swap="outerHTML"
                // Immediately toggle appearance
                "hx-on::before-request"="this.checked = !this.checked";

            span[todo.completed] { (todo.text) }
        }
    }
}
```

## Advanced Patterns

### Server-Sent Events (SSE) for Real-Time Updates

```rust
use axum::{
    response::sse::{Event, Sse},
    response::IntoResponse,
};
use tokio_stream::{Stream, StreamExt};
use std::convert::Infallible;

async fn notifications_stream() -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(Duration::from_secs(5));
        loop {
            interval.tick().await;

            let notification = fetch_latest_notification().await;
            let html = html! {
                div.notification {
                    (notification.message)
                }
            }.into_string();

            yield Ok(Event::default().data(html));
        }
    };

    Sse::new(stream)
}

// In template
fn notifications_panel() -> Markup {
    html! {
        div
            hx-ext="sse"
            sse-connect="/notifications/stream"
            sse-swap="message"
            hx-swap="beforeend"
        {
            p { "Waiting for notifications..." }
        }
    }
}
```

### Out-of-Band Swaps (Multiple Updates)

```rust
async fn update_with_side_effects() -> Markup {
    html! {
        // Main update
        div #main-content {
            p { "Content updated" }
        }

        // Out-of-band update (updates another part of the page)
        div
            #notification-count
            hx-swap-oob="true"
        {
            span.badge { "5" }
        }
    }
}
```

### Request Headers and HX-* Headers

```rust
use axum::http::HeaderMap;

async fn smart_handler(headers: HeaderMap) -> Markup {
    // Check if request is from HTMX
    let is_htmx = headers
        .get("HX-Request")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "true")
        .unwrap_or(false);

    if is_htmx {
        // Return partial
        html! {
            div { "Partial content" }
        }
    } else {
        // Return full page
        base_layout("Page", html! {
            div { "Full page content" }
        })
    }
}
```

## Production Considerations

### Error Handling

```rust
impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = match &self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Validation(_) => StatusCode::BAD_REQUEST,
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let markup = html! {
            div.alert.alert-error hx-swap-oob="true" #error-container {
                (self.to_string())
            }
        };

        (status, markup).into_response()
    }
}
```

### CSRF Protection

```rust
use axum_csrf::{CsrfConfig, CsrfToken};

async fn form_with_csrf(csrf_token: CsrfToken) -> Markup {
    html! {
        form hx-post="/submit" {
            input type="hidden" name="csrf_token" value=(csrf_token.authenticity_token());
            input type="text" name="data";
            button type="submit" { "Submit" }
        }
    }
}
```

### Loading States

```rust
fn button_with_loading() -> Markup {
    html! {
        button
            hx-post="/action"
            hx-indicator="#spinner"
        {
            span { "Submit" }
            span #spinner .htmx-indicator {
                "Loading..."
            }
        }
    }
}
```

## Best Practices

1. **Return HTML fragments, not JSON**: HTMX expects HTML responses
2. **Use semantic HTTP status codes**: HTMX respects status codes
3. **Progressive enhancement**: Ensure forms work without HTMX
4. **Idempotent operations**: GET should be safe, PUT/DELETE idempotent
5. **Use HX-Target wisely**: Specify targets to avoid page jumps
6. **Debounce user input**: Use `delay:` for search/autocomplete
7. **Handle errors gracefully**: Return error HTML, not JSON
8. **Use OOB swaps sparingly**: Too many can be confusing
9. **Test without JavaScript**: Forms should have fallback behavior

## Common Attributes Reference

```rust
// Triggers
"hx-trigger"="click"           // On click
"hx-trigger"="load"            // On page load
"hx-trigger"="every 2s"        // Polling
"hx-trigger"="intersect once"  // Infinite scroll
"hx-trigger"="keyup changed delay:500ms"  // Debounced input

// Swapping
"hx-swap"="innerHTML"    // Replace inner HTML
"hx-swap"="outerHTML"    // Replace element itself
"hx-swap"="beforebegin"  // Insert before element
"hx-swap"="afterend"     // Insert after element
"hx-swap"="delete"       // Remove element

// Targeting
"hx-target"="#id"              // Target by ID
"hx-target"="closest .class"   // Closest parent
"hx-target"="next .class"      // Next sibling
"hx-target"="this"             // The element itself
```

## References

- **HTMX Docs**: https://htmx.org
- **HARM Stack Article**: https://nguyenhuythanh.com/posts/the-harm-stack-considered-unharmful/
- **Maud Docs**: https://maud.lambda.xyz
- **Hypermedia Systems**: https://hypermedia.systems
