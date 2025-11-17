# MAUD Comprehensive Guide

*Compile-Time HTML Templates for Rust*
*Version: 0.27.0 (Latest as of Feb 2025)*

## Philosophy & Core Principles

**MAUD = Compile-Time Safety + Zero Runtime Overhead**

1. **Compile-time validation** - Template errors caught by rustc, not at runtime
2. **Type safety** - Leverages Rust's type system for HTML generation
3. **Zero overhead** - Templates compile to optimized Rust code (~100 SLoC runtime)
4. **No external dependencies** - Everything links into your binary
5. **Framework agnostic** - Works with Axum, Actix-web, Rocket, Warp, Tide, Poem, etc.

## Quick Reference Formula

```
ELEMENT[.CLASS][#ID][ ATTRIBUTES] { CONTENT }
```

**Rules:**
- Braces `{}` = Container elements
- Semicolon `;` = Void elements
- Parentheses `()` = Runtime values (escaped)
- Square brackets `[]` = Conditional attributes/classes
- At-sign `@` = Control flow

---

## I. SYNTAX PATTERNS

### Elements

#### Container Elements (with content)

```rust
html! {
    h1 { "Hello, world!" }
    p { "Paragraph text" }
    div { span { "Nested" } }
}
```

#### Void Elements (self-closing)

```rust
html! {
    br;
    hr;
    input type="text";
    img src="photo.jpg";
    link rel="stylesheet" href="style.css";
}
```

**Key**: Terminate with `;` - renders as `<br>` not `<br />`

#### DOCTYPE Declaration

```rust
html! {
    (DOCTYPE)
    html {
        head { title { "My Page" } }
        body { p { "Content" } }
    }
}
```

### Classes and IDs

#### Classes (chainable)

```rust
div.container { }
div.row.justify-center { }
p.text-lg.font-bold { }

// Quoted for special characters
div."col-sm-2" { }
div."bg-blue-500" { }
```

#### IDs (requires space in Rust 2021+)

```rust
div #main { }            // Rust 2021+
section #content { }
article #"post-123" { }  // Quoted for hyphens/numbers
```

#### Implicit Divs

```rust
#header { }           // Becomes <div id="header">
.container { }        // Becomes <div class="container">
.card.shadow { }      // <div class="card shadow">
```

### Attributes

#### Standard Attributes

```rust
a href="https://example.com" title="Link" { "Click" }
input type="text" placeholder="Enter name";
img src="photo.jpg" alt="Description";
```

#### Boolean Attributes (empty)

```rust
input checked;
input disabled;
option selected;
script defer;
```

#### Data Attributes and ARIA

```rust
article data-index="12345" data-category="tech" { }
button aria-label="Close" aria-pressed="true" { }
```

#### Custom Elements (fully supported)

```rust
tag-cloud { }
custom-widget data-id="123" { }
```

### Content

#### Text Content (auto-escaped)

```rust
p { "Hello <world>" }      // Outputs: Hello &lt;world&gt;
h1 { "Company & Co." }     // Outputs: Company &amp; Co.
```

#### Raw HTML (unescaped)

```rust
use maud::PreEscaped;

div {
    (PreEscaped("<strong>Bold</strong>"))
}
```

---

## II. DYNAMIC CONTENT

### Splices (Runtime Values)

#### Basic Splicing

```rust
let name = "Alice";
let count = 42;

html! {
    p { "Hello, " (name) "!" }        // Hello, Alice!
    p { "Count: " (count) }            // Count: 42
}
```

#### Expression Blocks

```rust
html! {
    p {
        "Result: "
        ({
            let x = 10;
            let y = 20;
            x + y
        })
    }
}
```

#### Attribute Splicing

```rust
let url = "https://example.com";
let id = "post-123";

html! {
    a href=(url) { "Link" }
    div id=(id) { "Content" }
}
```

#### Multiple Values in Attributes

```rust
let base_url = "https://example.com";
let path = "/page";

html! {
    a href={ (base_url) (path) } { "Link" }
    // Outputs: href="https://example.com/page"
}
```

#### Class Splicing

```rust
let class_name = "active";

html! {
    div.(class_name) { "Content" }
    // OR
    div class=(class_name) { "Content" }
}
```

#### ID Splicing

```rust
let element_id = "main-section";

html! {
    section #(element_id) { "Content" }
}
```

### Toggles (Conditional Rendering)

#### Boolean Attributes

```rust
let is_checked = true;
let is_disabled = false;

html! {
    input type="checkbox" checked[is_checked];
    button disabled[is_disabled] { "Submit" }
}
```

#### Conditional Classes

```rust
let is_active = true;
let has_error = false;

html! {
    div.base-class[is_active].error[has_error] { }
    // Renders: <div class="base-class active">
}
```

#### Optional Attributes

```rust
let maybe_title: Option<String> = Some("Tooltip".to_string());

html! {
    button title=[maybe_title] { "Hover" }
    // Renders: <button title="Tooltip">

    // If None, attribute is completely omitted
}
```

---

## III. CONTROL FLOW

### Conditionals

#### If/Else

```rust
let logged_in = true;

html! {
    @if logged_in {
        p { "Welcome back!" }
    } @else {
        p { "Please log in" }
    }
}
```

#### If Let (Pattern Matching)

```rust
let user: Option<User> = Some(User { name: "Alice" });

html! {
    @if let Some(user) = user {
        p { "Hello, " (user.name) }
    } @else {
        p { "Guest" }
    }
}
```

#### Match Expressions

```rust
enum Status { Active, Pending, Inactive }
let status = Status::Active;

html! {
    @match status {
        Status::Active => {
            span.badge.green { "Active" }
        }
        Status::Pending => {
            span.badge.yellow { "Pending" }
        }
        Status::Inactive => {
            span.badge.gray { "Inactive" }
        }
    }
}
```

### Loops

#### For Loops

```rust
let items = vec!["Apple", "Banana", "Cherry"];

html! {
    ul {
        @for item in &items {
            li { (item) }
        }
    }
}
```

#### With Index

```rust
html! {
    ol {
        @for (i, item) in items.iter().enumerate() {
            li { (i + 1) ". " (item) }
        }
    }
}
```

#### While Loops

```rust
let mut count = 0;

html! {
    @while count < 5 {
        p { "Count: " (count) }
        ({ count += 1; })
    }
}
```

### Let Bindings

```rust
html! {
    @let user_name = "Alice";
    @let greeting = format!("Hello, {}", user_name);

    h1 { (greeting) }

    @for i in 0..3 {
        @let doubled = i * 2;
        p { (i) " × 2 = " (doubled) }
    }
}
```

---

## IV. COMPONENTS & REUSABILITY

### The Render Trait

```rust
use maud::{html, Markup, Render};

struct User {
    name: String,
    email: String,
}

impl Render for User {
    fn render(&self) -> Markup {
        html! {
            div.user-card {
                h3 { (self.name) }
                p.email { (self.email) }
            }
        }
    }
}

// Usage
let user = User {
    name: "Alice".to_string(),
    email: "alice@example.com".to_string(),
};

html! {
    (user)  // Automatically calls render()
}
```

### Function Components

```rust
fn navbar(current_page: &str) -> Markup {
    html! {
        nav.navbar {
            a.nav-link[current_page == "home"] href="/" { "Home" }
            a.nav-link[current_page == "about"] href="/about" { "About" }
            a.nav-link[current_page == "contact"] href="/contact" { "Contact" }
        }
    }
}

// Usage
html! {
    (navbar("home"))
}
```

### Layout Components

```rust
fn layout(title: &str, content: Markup) -> Markup {
    html! {
        (DOCTYPE)
        html lang="en" {
            head {
                meta charset="UTF-8";
                title { (title) }
                link rel="stylesheet" href="/styles.css";
            }
            body {
                header { (navbar("home")) }
                main { (content) }
                footer { "© 2025" }
            }
        }
    }
}

// Usage
let page_content = html! {
    h1 { "Welcome" }
    p { "This is the home page" }
};

layout("Home", page_content)
```

### Parameterized Components

```rust
fn card(title: &str, description: &str, highlighted: bool) -> Markup {
    html! {
        div.card[highlighted] {
            h2.card-title { (title) }
            p.card-description { (description) }
        }
    }
}

html! {
    div.grid {
        (card("Title 1", "Description 1", true))
        (card("Title 2", "Description 2", false))
    }
}
```

---

## V. WEB FRAMEWORK INTEGRATION

### Feature Flags

```toml
[dependencies]
maud = { version = "0.27", features = ["axum"] }
```

**Available Features:**
- `"axum"` - Axum IntoResponse
- `"actix-web"` - Actix-web Responder
- `"rocket"` - Rocket Responder
- `"warp"` - Warp Reply
- `"tide"` - Tide From<PreEscaped<String>>
- `"poem"` - Poem IntoResponse
- `"submillisecond"` - Submillisecond IntoResponse

### Axum Integration

```rust
use axum::{response::Html, routing::get, Router};
use maud::{html, Markup};

async fn index() -> Markup {
    html! {
        h1 { "Hello, Axum!" }
        p { "Server-side rendered with MAUD" }
    }
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(index));

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000")
        .await
        .unwrap();

    axum::serve(listener, app).await.unwrap();
}
```

### Actix-web Integration

```rust
use actix_web::{get, App, HttpServer};
use maud::html;

#[get("/")]
async fn index() -> maud::Markup {
    html! {
        h1 { "Hello, Actix!" }
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    HttpServer::new(|| {
        App::new().service(index)
    })
    .bind(("127.0.0.1", 8080))?
    .run()
    .await
}
```

### Rocket Integration

```rust
#[macro_use] extern crate rocket;
use maud::html;

#[get("/")]
fn index() -> maud::Markup {
    html! {
        h1 { "Hello, Rocket!" }
    }
}

#[launch]
fn rocket() -> _ {
    rocket::build().mount("/", routes![index])
}
```

---

## VI. USE CASES & PATTERNS

### 1. Server-Side Rendering (SSR)

**When:** Full page renders on server, minimal JavaScript
**Stack:** MAUD + Axum + HTMX

```rust
async fn page(Query(params): Query<PageParams>) -> Markup {
    let data = fetch_data(params).await;

    html! {
        (layout("Page Title", html! {
            @for item in data {
                (card(&item.title, &item.description))
            }
        }))
    }
}
```

### 2. HTMX Partials

**When:** Dynamic updates without full page reload
**Stack:** MAUD + Axum + HTMX

```rust
async fn todo_list() -> Markup {
    html! {
        div hx-get="/todos" hx-trigger="load" {
            "Loading..."
        }
    }
}

async fn todos_partial() -> Markup {
    let todos = get_todos().await;

    html! {
        @for todo in todos {
            div.todo-item {
                input type="checkbox" checked[todo.completed];
                span { (todo.text) }
            }
        }
    }
}
```

### 3. Forms with Validation

```rust
async fn user_form(errors: Option<ValidationErrors>) -> Markup {
    html! {
        form method="POST" action="/users" {
            div.form-group {
                label { "Name" }
                input type="text" name="name" required;
                @if let Some(errs) = &errors {
                    @if let Some(err) = errs.get("name") {
                        span.error { (err) }
                    }
                }
            }

            button type="submit" { "Submit" }
        }
    }
}
```

### 4. API Responses (JSON-LD)

```rust
async fn article_page(id: i32) -> Markup {
    let article = get_article(id).await;

    html! {
        article {
            h1 { (article.title) }
            (article_json_ld(&article))
            (PreEscaped(&article.html_content))
        }
    }
}

fn article_json_ld(article: &Article) -> Markup {
    html! {
        script type="application/ld+json" {
            (PreEscaped(&serde_json::to_string(&article.schema()).unwrap()))
        }
    }
}
```

### 5. Email Templates

```rust
fn welcome_email(user: &User) -> Markup {
    html! {
        (DOCTYPE)
        html {
            head {
                meta charset="UTF-8";
            }
            body style="font-family: sans-serif;" {
                h1 { "Welcome, " (user.name) "!" }
                p { "Thanks for signing up." }
                a href="https://example.com/verify" { "Verify Email" }
            }
        }
    }
}
```

### 6. RSS/Atom Feeds

```rust
fn rss_feed(posts: &[Post]) -> Markup {
    html! {
        (PreEscaped("<?xml version=\"1.0\" encoding=\"UTF-8\"?>"))
        rss version="2.0" {
            channel {
                title { "My Blog" }
                link { "https://example.com" }
                @for post in posts {
                    item {
                        title { (post.title) }
                        link { "https://example.com/posts/" (post.id) }
                        description { (post.summary) }
                    }
                }
            }
        }
    }
}
```

---

## VII. BEST PRACTICES

### Performance

1. **Compile-time optimization** - Templates compile to optimal Rust code
2. **Zero allocations** - Static strings embedded in binary
3. **Streaming** - Use `Markup::into_string()` or `IntoResponse` for zero-copy
4. **Caching** - Cache rendered components, not MAUD calls

### Security

1. **Auto-escaping** - All text content is HTML-escaped by default
2. **Explicit raw HTML** - Use `PreEscaped` only when necessary
3. **SQL injection** - Use parameterized queries (SQLx), not string interpolation
4. **XSS prevention** - Never splice untrusted HTML without escaping

### Code Organization

```
src/
├── main.rs
├── routes/
│   ├── mod.rs
│   ├── users.rs
│   └── posts.rs
├── templates/
│   ├── mod.rs
│   ├── layout.rs      # Base layouts
│   ├── components.rs  # Reusable components
│   └── pages/
│       ├── home.rs
│       ├── about.rs
│       └── contact.rs
```

### Component Design

```rust
// ✅ Good: Pure function, type-safe parameters
fn user_card(user: &User, is_admin: bool) -> Markup {
    html! { /* ... */ }
}

// ❌ Bad: Stringly-typed, no compile-time checks
fn user_card(name: &str, email: &str, role: &str) -> Markup {
    html! { /* ... */ }
}
```

---

## VIII. COMMON PATTERNS

### Navigation with Active State

```rust
fn nav_link(href: &str, text: &str, current: &str) -> Markup {
    html! {
        a.nav-link[current == href] href=(href) { (text) }
    }
}
```

### Pagination

```rust
fn pagination(current: u32, total: u32) -> Markup {
    html! {
        nav.pagination {
            @if current > 1 {
                a href={ "/page/" (current - 1) } { "← Previous" }
            }
            span { "Page " (current) " of " (total) }
            @if current < total {
                a href={ "/page/" (current + 1) } { "Next →" }
            }
        }
    }
}
```

### Error Pages

```rust
fn error_page(code: u16, message: &str) -> Markup {
    layout(&format!("Error {}", code), html! {
        div.error-container {
            h1 { (code) }
            p { (message) }
            a href="/" { "← Go Home" }
        }
    })
}
```

### Loading States

```rust
fn loading_spinner() -> Markup {
    html! {
        div.spinner {
            div.spinner-border { }
            span { "Loading..." }
        }
    }
}
```

---

## IX. MIGRATION GUIDE

### From Askama

```rust
// Askama (separate file)
// templates/index.html
// <h1>{{ title }}</h1>

// MAUD (inline, compile-time checked)
html! {
    h1 { (title) }
}
```

### From Tera

```rust
// Tera (runtime, string-based)
context.insert("name", &name);
tera.render("template.html", &context)?

// MAUD (compile-time, type-safe)
html! {
    p { "Hello, " (name) }
}
```

### From Handlebars

```rust
// Handlebars
// {{#each items}}
// <li>{{this}}</li>
// {{/each}}

// MAUD
@for item in &items {
    li { (item) }
}
```

---

## X. TROUBLESHOOTING

### Common Errors

**Error**: "expected `,`, found `{`"
**Fix**: Add space before `#id` in Rust 2021+
```rust
div #myid { }  // ✅ Correct
div#myid { }   // ❌ Error
```

**Error**: "the trait bound `Foo: Render` is not satisfied"
**Fix**: Implement `Render` trait or convert to String
```rust
impl Render for Foo {
    fn render(&self) -> Markup {
        html! { (self.to_string()) }
    }
}
```

**Error**: "cannot infer type"
**Fix**: Specify types explicitly
```rust
let items: Vec<String> = vec![]; // ✅
let items = vec![];              // ❌ May fail in templates
```

---

## XI. QUICK DECISION TREE

**Choose MAUD when:**
- ✅ Type safety is critical
- ✅ Compile-time validation needed
- ✅ Zero runtime overhead required
- ✅ Integrating with Rust web frameworks
- ✅ Building server-side rendered apps
- ✅ Template logic is complex (Rust control flow)

**Consider alternatives when:**
- ❌ Designers need to edit templates directly
- ❌ Templates must be loaded dynamically
- ❌ Hot-reloading is essential for development
- ❌ Team unfamiliar with Rust syntax
- ❌ Non-technical content editors

---

## XII. ECOSYSTEM COMPARISON

| Feature | MAUD | Askama | Tera | Handlebars |
|---------|------|--------|------|------------|
| Compile-time | ✅ Yes | ✅ Yes | ❌ No | ❌ No |
| Type-safe | ✅ Yes | ✅ Yes | ⚠️ Partial | ❌ No |
| Hot-reload | ❌ No* | ❌ No | ✅ Yes | ✅ Yes |
| Syntax | Rust-like | Jinja2-like | Jinja2-like | Handlebars |
| Performance | ⚡ Fastest | ⚡ Fastest | 🐌 Slower | 🐌 Slower |
| Binary size | 📦 Smallest | 📦 Small | 📦 Larger | 📦 Larger |
| Learning curve | Steep | Medium | Easy | Easy |

*Can be achieved with shared library reloading (see kdar/rust-webapp-maud-refresh)

---

## XIII. RESOURCES

**Official:**
- Documentation: https://maud.lambda.xyz
- Repository: https://github.com/lambda-fairy/maud
- Crates.io: https://crates.io/crates/maud
- API Docs: https://docs.rs/maud

**Community:**
- GitHub Topics: https://github.com/topics/maud
- Rust Forum: https://users.rust-lang.org (search "maud")
- r/rust: Reddit community

**Examples:**
- HARM Stack: https://nguyenhuythanh.com/posts/the-harm-stack-considered-unharmful/
- websurfx: https://github.com/neon-mmd/websurfx
- Auth0 Example: https://github.com/auth0-samples/auth0-rocket-rust-example

**Version History:**
- v0.27.0 (Feb 2025) - Latest
- v0.26.x - Stable
- v0.25.x - Actix-web updates

---

**Last Updated**: January 16, 2025
**MAUD Version**: 0.27.0
**Rust Edition**: 2021
