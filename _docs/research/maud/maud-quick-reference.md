# MAUD Quick Reference Cheat Sheet

*Ultra-terse guide to MAUD syntax and patterns*

## Core Syntax Formula

```
ELEMENT[.CLASS][#ID][ ATTRS] { CONTENT };
```

- `{}` = container | `;` = void | `()` = splice | `[]` = toggle | `@` = control

---

## Elements

```rust
h1 { "Text" }                    // Container
br;                              // Void
div.class { }                    // Class
section #id { }                  // ID (space required)
.container { }                   // Implicit div
a href="url" { "Link" }          // Attributes
input checked;                   // Boolean attr
```

---

## Dynamic Content

```rust
(value)                          // Splice (escaped)
(PreEscaped(html))              // Raw HTML
({ expr })                       // Code block
href=(url)                       // Attr splice
href={ (base) (path) }          // Multi-value
.(class_name)                    // Class splice
#(element_id)                    // ID splice
```

---

## Conditionals

```rust
checked[bool_expr]               // Toggle attr
.active[is_active]              // Toggle class
title=[optional_value]          // Optional attr

@if cond { html! { } }          // If
@if cond { } @else { }          // If-else
@if let Some(x) = opt { }       // If-let

@match val {                     // Match
    Variant::A => { }
    Variant::B => { }
}
```

---

## Loops

```rust
@for item in items { }           // For loop
@for (i, x) in iter.enumerate() // With index
@while cond { }                  // While
@let var = value;                // Let binding
```

---

## Components

```rust
// Render trait
impl Render for T {
    fn render(&self) -> Markup {
        html! { }
    }
}

// Function component
fn card(title: &str) -> Markup {
    html! {
        div.card { h2 { (title) } }
    }
}

// Usage
(component)                      // Auto-renders
(card("Title"))                  // Function call
```

---

## Web Frameworks

```toml
# Cargo.toml
maud = { version = "0.27", features = ["axum"] }
```

```rust
// Axum
async fn handler() -> Markup {
    html! { h1 { "Hello" } }
}

// Actix-web
#[get("/")]
async fn index() -> maud::Markup {
    html! { h1 { "Hello" } }
}

// Rocket
#[get("/")]
fn index() -> maud::Markup {
    html! { h1 { "Hello" } }
}
```

---

## Common Patterns

```rust
// Layout
fn layout(title: &str, content: Markup) -> Markup {
    html! {
        (DOCTYPE)
        html {
            head { title { (title) } }
            body { (content) }
        }
    }
}

// Nav link
fn nav(href: &str, text: &str, active: bool) -> Markup {
    html! {
        a.nav-link[active] href=(href) { (text) }
    }
}

// Card
fn card(title: &str, body: &str) -> Markup {
    html! {
        div.card {
            h3 { (title) }
            p { (body) }
        }
    }
}

// List
fn list(items: &[String]) -> Markup {
    html! {
        ul {
            @for item in items {
                li { (item) }
            }
        }
    }
}

// Form field
fn field(name: &str, err: Option<&str>) -> Markup {
    html! {
        div.field {
            input name=(name);
            @if let Some(e) = err {
                span.error { (e) }
            }
        }
    }
}
```

---

## HTMX Integration

```rust
html! {
    div hx-get="/data" hx-trigger="load" { "Loading..." }
    button hx-post="/action" hx-swap="outerHTML" { "Click" }
    form hx-post="/submit" hx-target="#result" {
        input name="email" type="email";
        button { "Submit" }
    }
}
```

---

## Stacks

**MASH** = Maud + Axum + SQLx + HTMX
**HARM** = HTMX + Axum + Rust + Maud

```rust
// Typical setup
use axum::{routing::get, Router};
use maud::{html, Markup};

#[tokio::main]
async fn main() {
    Router::new()
        .route("/", get(index))
        .listen("0.0.0.0:3000")
        .await
        .unwrap();
}

async fn index() -> Markup {
    html! {
        (DOCTYPE)
        html {
            head {
                script src="https://unpkg.com/htmx.org" { }
            }
            body {
                h1 { "MASH Stack" }
                div hx-get="/api/data" { "Loading..." }
            }
        }
    }
}
```

---

## Quick Decisions

| Need | Use |
|------|-----|
| Text content | `{ "text" }` |
| Dynamic value | `(var)` |
| Raw HTML | `(PreEscaped(html))` |
| Conditional class | `.active[bool]` |
| Optional attr | `title=[option]` |
| Loop | `@for x in items { }` |
| If/else | `@if cond { } @else { }` |
| Component | `fn name() -> Markup` |
| Render trait | `impl Render for T` |

---

## Performance Tips

1. Templates compile to Rust code (zero runtime overhead)
2. Static strings embedded in binary
3. Use `.into_string()` for String conversion
4. Cache rendered Markup, not html! calls
5. ~100 SLoC runtime library

---

## Common Gotchas

```rust
// ❌ Missing space (Rust 2021+)
div#id { }

// ✅ Correct
div #id { }

// ❌ Unescaped HTML
{ "<b>Bold</b>" }  // Outputs: &lt;b&gt;

// ✅ Correct
(PreEscaped("<b>Bold</b>"))

// ❌ Missing Render trait
(custom_struct)  // Error

// ✅ Implement Render
impl Render for CustomStruct {
    fn render(&self) -> Markup { html! { } }
}
```

---

## Minimal Example

```rust
use maud::{html, Markup, DOCTYPE};

fn main() {
    let page = html! {
        (DOCTYPE)
        html {
            head { title { "Page" } }
            body {
                h1 { "Hello, MAUD!" }
                (greeting("World"))
            }
        }
    };

    println!("{}", page.into_string());
}

fn greeting(name: &str) -> Markup {
    html! {
        p { "Hello, " (name) "!" }
    }
}
```

---

**Version**: 0.27.0 (Feb 2025)
**Docs**: https://maud.lambda.xyz
**Repo**: https://github.com/lambda-fairy/maud
