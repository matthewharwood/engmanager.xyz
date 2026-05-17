use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Html;
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use rust_embed::RustEmbed;

use super::{GOOGLE_FONTS_HREF, OPEN_PROPS_HREF};

// Article bodies live in `website/articles/{slug}.md`. They're embedded into
// the binary at compile time alongside the rest of the static content (so the
// .md source isn't HTTP-exposed under /assets/ — only the rendered HTML ships).
#[derive(RustEmbed)]
#[folder = "articles/"]
struct ArticleSources;

pub struct Article {
    pub slug: &'static str,
    pub title: &'static str,
    pub date: &'static str,
    pub summary: &'static str,
}

pub const ARTICLES: &[Article] = &[Article {
    slug: "claude-code-lsp",
    title: "Claude Code now has LSP support. Here's why that actually matters for TypeScript & Rust devs.",
    date: "December 29, 2025",
    summary: "I asked Claude to refactor a function used in 47 places across our monorepo. grep found 31. With LSP, Claude found all 47.",
}];

fn layout(title: &str, body: HtmlFragment) -> HtmlFragment {
    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ title }</title>
                <link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" />
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href="/assets/styles.css" />
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
                <script src="/assets/scripts/copy-code.js" defer></script>
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

pub async fn detail(Path(slug): Path<String>) -> Result<Html<String>, StatusCode> {
    let article = ARTICLES.iter().find(|a| a.slug == slug);
    match article {
        Some(a) => {
            let inner = article_body(&slug).unwrap_or_else(HtmlFragment::empty);
            let body = view! {
                <article class="article">
                    <h1 class="article-title">{ a.title }</h1>
                    <p class="article-byline">"Matthew Harwood · Engineering Manager @ Uber"</p>
                    <p class="article-date">{ a.date }</p>
                    { inner }
                </article>
            };
            Ok(Html(layout(a.title, body).into_string()))
        }
        None => Err(StatusCode::NOT_FOUND),
    }
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

