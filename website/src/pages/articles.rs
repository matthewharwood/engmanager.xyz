use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Html;
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use rust_embed::RustEmbed;

use super::{AVATAR_SRC, GOOGLE_FONTS_HREF, OPEN_PROPS_HREF};
use crate::asset_url;

// Article bodies live in `website/articles/{slug}.md`. They're embedded into
// the binary at compile time alongside the rest of the static content (so the
// .md source isn't HTTP-exposed under /assets/ — only the rendered HTML ships).
#[derive(RustEmbed)]
#[folder = "articles/"]
struct ArticleSources;

pub struct Article {
    pub slug: &'static str,
    /// Title shown on the homepage's fluid-SVG stack. Can be anything —
    /// a sentence, a URL, etc.
    pub title: &'static str,
    /// Optional override for the article-page <h1> (and browser <title>).
    /// `None` falls back to `title`. Use this when the homepage display
    /// should differ from the article page's heading — e.g. a Discord URL
    /// on the stack but a real headline on the article itself.
    pub title_alias: Option<&'static str>,
    pub date: &'static str,
    pub summary: &'static str,
}

pub const ARTICLES: &[Article] = &[
    Article {
        slug: "talking-not-typing",
        title: "I Ship Sites By Talking, Not Typing",
        title_alias: None,
        date: "May 17, 2026",
        summary: "I built three Rust projects this week without typing a single line of code. Voice → Claude Code → pull requests. The floor is rising for everyone.",
    },
    Article {
        slug: "auteurs",
        title: "https://discord.gg/sTzQBrbnBM",
        title_alias: Some(
            "Auteur's a discord for managing early career engineers, product and designers",
        ),
        date: "March 14, 2026",
        summary: "Auteurs: a community of engineers, designers, and product managers shipping things that matter. Scan the QR or click through to join the Discord.",
    },
    Article {
        slug: "claude-code-lsp",
        title: "Claude Code now has LSP support. Here's why that actually matters for TypeScript & Rust devs.",
        title_alias: None,
        date: "December 29, 2025",
        summary: "I asked Claude to refactor a function used in 47 places across our monorepo. grep found 31. With LSP, Claude found all 47.",
    },
    Article {
        slug: "jsx-like-rust-macro",
        title: "Making an JSX like Rust Macro",
        title_alias: None,
        date: "May 31, 2025",
        summary: "Step one of a web framework experiment: building a JSX-like declarative macro in Rust with macro_rules!.",
    },
];

fn layout(title: &str, body: HtmlFragment) -> HtmlFragment {
    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ title }</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("styles.css") } />
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
                <script src={ asset_url("scripts/copy-code.js") } defer></script>
                <script src={ asset_url("scripts/auteurs-shader.js") } defer></script>
            </head>
            <body class="articles-page">
                <nav class="article-nav">
                    <a class="article-nav-link" href="/">"← engmanager.xyz"</a>
                </nav>
                { body }
            </body>
        </html>
    }
}

pub async fn index() -> Html<String> {
    let entries: HtmlFragment = ARTICLES
        .iter()
        .map(|a| {
            view! {
                <li class="article-entry">
                    <a class="article-entry-title" href={ format!("/articles/{}", a.slug) }>
                        { a.title }
                    </a>
                    <span class="article-entry-date">{ a.date }</span>
                    <p class="article-entry-summary">{ a.summary }</p>
                </li>
            }
        })
        .collect();

    let body = view! {
        <section class="articles-index">
            <h1 class="articles-index-title">"ARTICLES"</h1>
            <ul class="article-list">{ entries }</ul>
        </section>
    };

    Html(layout("Articles · engmanager.xyz", body).into_string())
}

// Marker in auteurs.md that gets string-replaced with the live Discord
// widget HTML at render time. Pulldown-cmark passes raw HTML blocks
// through verbatim, so the comment survives Markdown rendering.
const DISCORD_WIDGET_SENTINEL: &str = "<!--auteurs-discord-widget-->";

pub async fn detail(Path(slug): Path<String>) -> Result<Html<String>, StatusCode> {
    let article = ARTICLES.iter().find(|a| a.slug == slug);
    match article {
        Some(a) => {
            // Article-page heading + browser <title> use title_alias when set.
            let page_title = a.title_alias.unwrap_or(a.title);
            let inner = article_body(&slug).unwrap_or_else(HtmlFragment::empty);
            let inner = splice_discord_widget(&slug, inner).await;
            let body = view! {
                <article class="article">
                    <h1 class="article-title">{ page_title }</h1>
                    <header class="article-meta">
                        <img class="article-meta-avatar"
                             src=AVATAR_SRC
                             alt="Matthew Harwood"
                             width="40"
                             height="40"
                             loading="lazy" />
                        <div class="article-meta-author">
                            <div class="article-meta-name">"Matthew Harwood"</div>
                            <div class="article-meta-role">"Engineering Manager @ Uber"</div>
                        </div>
                        <time class="article-meta-date">{ a.date }</time>
                    </header>
                    { inner }
                </article>
            };
            Ok(Html(layout(page_title, body).into_string()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
}

// Renders the live Discord widget into the body HTML if the article has
// a `<!--auteurs-discord-widget-->` sentinel and we have a fresh snapshot.
// When the snapshot is cold or the article doesn't reference the widget,
// the sentinel is dropped (empty string) and the article's static fallback
// (QR code + invite link) remains as the join CTA.
async fn splice_discord_widget(slug: &str, body: HtmlFragment) -> HtmlFragment {
    let body_str = body.as_str();
    if !body_str.contains(DISCORD_WIDGET_SENTINEL) {
        return body;
    }
    let replacement = match crate::discord::snapshot().await {
        Some(snap) if slug == "auteurs" => crate::discord::render(&snap).into_string(),
        _ => String::new(),
    };
    HtmlFragment::new(body_str.replace(DISCORD_WIDGET_SENTINEL, &replacement))
}

// Loads the Markdown for an article slug, parses it with pulldown-cmark, and
// returns the rendered HTML wrapped in an HtmlFragment (which view! splices
// in without re-escaping). pulldown-cmark preserves language hints on code
// fences as `<code class="language-X">`, which Prism's autoloader then targets
// for syntax highlighting. Returns None for unknown slugs.
fn article_body(slug: &str) -> Option<HtmlFragment> {
    let path = format!("{slug}.md");
    let file = ArticleSources::get(&path)?;
    let markdown = std::str::from_utf8(&file.data).ok()?;

    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    options.insert(pulldown_cmark::Options::ENABLE_STRIKETHROUGH);
    options.insert(pulldown_cmark::Options::ENABLE_TASKLISTS);
    options.insert(pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES);

    let parser = pulldown_cmark::Parser::new_ext(markdown, options);
    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, parser);
    Some(HtmlFragment::new(html_output))
}

