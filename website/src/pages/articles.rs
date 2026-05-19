use std::collections::HashMap;

use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Html;
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use pulldown_cmark::{CowStr, Event, HeadingLevel, Tag as PmTag, TagEnd};
use rust_embed::RustEmbed;

use super::{AVATAR_SRC, GOOGLE_FONTS_HREF, OPEN_PROPS_HREF};
use crate::asset_url;

// Article bodies live in `website/articles/{slug}.md`. They're embedded into
// the binary at compile time alongside the rest of the static content (so the
// .md source isn't HTTP-exposed under /assets/ — only the rendered HTML ships).
#[derive(RustEmbed)]
#[folder = "articles/"]
struct ArticleSources;

// =============================================================================
// Taxonomy — single source of truth for categories and tags.
//
// Both are enums so the article table is type-checked: a typo in a category
// or tag fails to compile, and a renamed variant fans out across every
// article that references it. Each variant carries a human label (for
// rendering) and a URL slug (for any future /category/{slug} or
// /tag/{slug} routes).
//
// Each article has ONE Category (single primary section) and a `&'static
// [Tag]` slice. The slice is normalized into a unique, order-preserving
// set at render time (see `unique_tags`) so authors can list tags in
// whatever order makes sense without worrying about accidental duplicates.
// A debug-only assertion at server startup also flags duplicate tags
// during development.
// =============================================================================

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Category {
    EngineeringLeadership,
    DeveloperTooling,
    Workflow,
    Community,
    FrameworkDesign,
}

impl Category {
    pub const ALL: &'static [Category] = &[
        Self::Workflow,
        Self::DeveloperTooling,
        Self::FrameworkDesign,
        Self::Community,
        Self::EngineeringLeadership,
    ];

    pub fn label(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "Eng Leadership",
            Self::DeveloperTooling => "Dev Tooling",
            Self::Workflow => "Workflow",
            Self::Community => "Community",
            Self::FrameworkDesign => "Frameworks",
        }
    }

    pub fn slug(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "engineering-leadership",
            Self::DeveloperTooling => "developer-tooling",
            Self::Workflow => "workflow",
            Self::Community => "community",
            Self::FrameworkDesign => "framework-design",
        }
    }

    pub fn emoji(self) -> &'static str {
        match self {
            Self::EngineeringLeadership => "👔",
            Self::DeveloperTooling => "🛠",
            Self::Workflow => "🌀",
            Self::Community => "👥",
            Self::FrameworkDesign => "🧱",
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub enum Tag {
    Ai,
    ClaudeCode,
    Rust,
    Voice,
    Mcp,
    Discord,
    Community,
    Mentorship,
    Lsp,
    TypeScript,
    DeveloperTooling,
    Macros,
    Framework,
    JsxLike,
    Workflow,
    Solopreneur,
    LocalFirst,
}

impl Tag {
    pub fn label(self) -> &'static str {
        match self {
            Self::Ai => "ai",
            Self::ClaudeCode => "claude-code",
            Self::Rust => "rust",
            Self::Voice => "voice",
            Self::Mcp => "mcp",
            Self::Discord => "discord",
            Self::Community => "community",
            Self::Mentorship => "mentorship",
            Self::Lsp => "lsp",
            Self::TypeScript => "typescript",
            Self::DeveloperTooling => "developer-tooling",
            Self::Macros => "macros",
            Self::Framework => "framework",
            Self::JsxLike => "jsx-like",
            Self::Workflow => "workflow",
            Self::Solopreneur => "solopreneur",
            Self::LocalFirst => "local-first",
        }
    }

    pub fn emoji(self) -> &'static str {
        match self {
            Self::Ai => "🤖",
            Self::ClaudeCode => "⚡",
            Self::Rust => "🦀",
            Self::Voice => "🎙",
            Self::Mcp => "🔌",
            Self::Discord => "💬",
            Self::Community => "🧑‍🤝‍🧑",
            Self::Mentorship => "🎓",
            Self::Lsp => "🔎",
            Self::TypeScript => "🟦",
            Self::DeveloperTooling => "🛠",
            Self::Macros => "🪄",
            Self::Framework => "🏗",
            Self::JsxLike => "⚛",
            Self::Workflow => "🌀",
            Self::Solopreneur => "🧑‍💻",
            Self::LocalFirst => "📦",
        }
    }
}

// Order-preserving dedup. Backing data is a `&[Tag]` so authors can list
// tags in significance order; we drop later duplicates and return a Vec
// that the meta renderer iterates. Compile-time enum guarantees that
// each variant is itself unique; this step protects against
// human-authored repetition in the slice.
fn unique_tags(tags: &[Tag]) -> Vec<Tag> {
    let mut seen = std::collections::HashSet::with_capacity(tags.len());
    tags.iter()
        .copied()
        .filter(|t| seen.insert(*t))
        .collect()
}

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
    /// Primary section. Exactly one per article.
    pub category: Category,
    /// Free-form tags. Deduped to a set at render time via `unique_tags`.
    pub tags: &'static [Tag],
}

pub const ARTICLES: &[Article] = &[
    Article {
        slug: "talking-not-typing",
        title: "I Ship Sites By Talking, Not Typing",
        title_alias: None,
        date: "May 17, 2026",
        summary: "I built three Rust projects this week without typing a single line of code. Voice → Claude Code → pull requests. The floor is rising for everyone.",
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Voice,
            Tag::Mcp,
            Tag::Rust,
            Tag::Workflow,
            Tag::Solopreneur,
            Tag::LocalFirst,
        ],
    },
    Article {
        slug: "auteurs",
        title: "https://discord.gg/sTzQBrbnBM",
        title_alias: Some(
            "Auteur's a discord for managing early career engineers, product and designers",
        ),
        date: "March 14, 2026",
        summary: "Auteurs: a community of engineers, designers, and product managers shipping things that matter. Scan the QR or click through to join the Discord.",
        category: Category::Community,
        tags: &[Tag::Community, Tag::Discord, Tag::Mentorship],
    },
    Article {
        slug: "claude-code-lsp",
        title: "Claude Code now has LSP support. Here's why that actually matters for TypeScript & Rust devs.",
        title_alias: None,
        date: "December 29, 2025",
        summary: "I asked Claude to refactor a function used in 47 places across our monorepo. grep found 31. With LSP, Claude found all 47.",
        category: Category::DeveloperTooling,
        tags: &[
            Tag::ClaudeCode,
            Tag::Lsp,
            Tag::DeveloperTooling,
            Tag::Rust,
            Tag::TypeScript,
        ],
    },
    Article {
        slug: "jsx-like-rust-macro",
        title: "Making an JSX like Rust Macro",
        title_alias: None,
        date: "May 31, 2025",
        summary: "Step one of a web framework experiment: building a JSX-like declarative macro in Rust with macro_rules!.",
        category: Category::FrameworkDesign,
        tags: &[Tag::Rust, Tag::Macros, Tag::Framework, Tag::JsxLike],
    },
];

// Debug-only: catch accidental tag duplicates during dev. Production
// builds skip this since enums + `unique_tags` already guarantee a
// clean rendered set; the check is just a faster signal for the
// author than spotting "rust rust" in the rendered chip row.
#[cfg(debug_assertions)]
pub(crate) fn debug_check_tag_uniqueness() {
    for article in ARTICLES {
        let original = article.tags.len();
        let unique = unique_tags(article.tags).len();
        debug_assert_eq!(
            original, unique,
            "article `{}` has duplicate tags in its slice",
            article.slug
        );
    }
}

// Category pill + ghost-style tag chips for the article-meta row.
// Lays out as a full-width second row beneath the avatar/byline:
//
//   [CATEGORY]  tag  tag  tag  tag
//
// Category is a filled accent-tinted pill (single primary section);
// tags are smaller muted chips. Tags are deduped via unique_tags
// (set semantics) so authors can list them in significance order
// without worrying about repetition.
fn render_taxonomy(category: Category, tags: &[Tag]) -> HtmlFragment {
    let tag_chips: HtmlFragment = unique_tags(tags)
        .into_iter()
        .map(|t| {
            view! {
                <span class="article-tag">{ t.label() }</span>
            }
        })
        .collect();

    view! {
        <div class="article-taxonomy">
            <span class="article-category" data-category={ category.slug() }>
                { category.label() }
            </span>
            <div class="article-tags" aria-label="Tags">
                { tag_chips }
            </div>
        </div>
    }
}

// Vercel-style dropdown trigger + panel containing the latest three
// articles. The trigger keeps the `.is-current` highlight so the nav
// reads identically to before for users on browsers without JS — the
// markup is still a clickable disclosure with all targets inside.
fn render_articles_dropdown() -> HtmlFragment {
    let items: HtmlFragment = ARTICLES
        .iter()
        .take(3)
        .enumerate()
        .map(|(i, a)| {
            let display = a.title_alias.unwrap_or(a.title);
            view! {
                <a class="nav-dropdown-item"
                   href={ format!("/articles/{}", a.slug) }
                   role="menuitem">
                    <span class="nav-dropdown-item-index" aria-hidden="true">
                        { format!("{}", i + 1) }
                    </span>
                    <div class="nav-dropdown-item-body">
                        <div class="nav-dropdown-item-title">{ display }</div>
                        <div class="nav-dropdown-item-date">{ a.date }</div>
                    </div>
                </a>
            }
        })
        .collect();

    view! {
        <div class="nav-dropdown">
            <button class="nav-dropdown-trigger is-current"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded="false">
                "Articles"
                <svg class="nav-dropdown-chevron" viewBox="0 0 10 10" aria-hidden="true">
                    <path d="M2 4 L5 7 L8 4"
                          fill="none"
                          stroke="currentColor"
                          stroke-width="1.4"
                          stroke-linecap="round"
                          stroke-linejoin="round" />
                </svg>
            </button>
            <div class="nav-dropdown-panel" role="menu">
                { items }
                <hr class="nav-dropdown-divider" />
                <a class="nav-dropdown-all" href="/articles/" role="menuitem">
                    "All articles"
                    <span class="nav-dropdown-all-arrow" aria-hidden="true">"→"</span>
                </a>
            </div>
        </div>
    }
}

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
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/articles.css") } />
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
                <script src={ asset_url("js/copy-code.js") } defer></script>
                <script src={ asset_url("js/auteurs-shader.js") } defer></script>
                <script src={ asset_url("js/toc-waypoints.js") } defer></script>
                <script src={ asset_url("js/to-top.js") } defer></script>
                <script src={ asset_url("js/nav-dropdown.js") } defer></script>
                <script src={ asset_url("js/view-transitions.js") } defer></script>
            </head>
            <body class="articles-page">
                <nav class="site-nav" aria-label="Primary">
                    <a class="site-nav-brand" href="/" aria-label="engmanager.xyz home">
                        <img class="site-nav-mark"
                             src={ asset_url("favicon.svg") }
                             alt=""
                             width="20"
                             height="20"
                             aria-hidden="true" />
                        <span class="site-nav-wordmark">"engmanager.xyz"</span>
                    </a>
                    <div class="site-nav-links">
                        { render_articles_dropdown() }
                        <a class="site-nav-link" href="https://discord.gg/sTzQBrbnBM" target="_blank" rel="noopener">"Discord"</a>
                        <a class="site-nav-link" href="https://github.com/matthewharwood" target="_blank" rel="noopener">"GitHub"</a>
                    </div>
                </nav>
                { body }
                <button class="to-top" type="button" aria-label="Scroll to top">
                    <svg class="to-top-icon" viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M8 12 L8 4 M3.5 8 L8 3.5 L12.5 8"
                              fill="none"
                              stroke="currentColor"
                              stroke-width="1.6"
                              stroke-linecap="round"
                              stroke-linejoin="round" />
                    </svg>
                </button>
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
            let (inner, headings) = article_body(&slug)
                .unwrap_or_else(|| (HtmlFragment::empty(), Vec::new()));
            let inner = splice_discord_widget(&slug, inner).await;
            let toc = render_toc(&headings);
            let vt_name = format!("view-transition-name: article-{slug}");
            let taxonomy = render_taxonomy(a.category, a.tags);
            let body = view! {
                <article class="article">
                    <h1 class="article-title" style={ vt_name }>{ page_title }</h1>
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
                        { taxonomy }
                    </header>
                    { inner }
                </article>
                { toc }
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

// A heading destined for the on-this-page sidebar.
pub struct Heading {
    pub level: u32, // 2 or 3
    pub slug: String,
    pub text: String,
}

// Loads the Markdown for an article slug, parses it with pulldown-cmark,
// assigns an `id` to each h2/h3 (so the sidebar TOC can scroll-anchor to
// them), and returns the rendered HTML alongside the heading list. The
// h1 from the article title is rendered by the outer layout, not the
// Markdown, so headings here start at h2.
fn article_body(slug: &str) -> Option<(HtmlFragment, Vec<Heading>)> {
    let path = format!("{slug}.md");
    let file = ArticleSources::get(&path)?;
    let markdown = std::str::from_utf8(&file.data).ok()?;

    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    options.insert(pulldown_cmark::Options::ENABLE_STRIKETHROUGH);
    options.insert(pulldown_cmark::Options::ENABLE_TASKLISTS);
    options.insert(pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES);

    let parser = pulldown_cmark::Parser::new_ext(markdown, options);
    let mut events: Vec<Event> = parser.collect();
    let mut headings: Vec<Heading> = Vec::new();
    let mut slug_counts: HashMap<String, u32> = HashMap::new();

    let mut i = 0;
    while i < events.len() {
        let level = match &events[i] {
            Event::Start(PmTag::Heading {
                level: l @ (HeadingLevel::H2 | HeadingLevel::H3),
                id: None,
                ..
            }) => *l,
            _ => {
                i += 1;
                continue;
            }
        };

        // Walk to the matching End(Heading), gathering text content.
        let mut text = String::new();
        let mut j = i + 1;
        while j < events.len() {
            match &events[j] {
                Event::End(TagEnd::Heading(_)) => break,
                Event::Text(t) | Event::Code(t) => text.push_str(t),
                _ => {}
            }
            j += 1;
        }

        let base_slug = slugify(&text);
        if base_slug.is_empty() {
            i = j + 1;
            continue;
        }
        let count = slug_counts.entry(base_slug.clone()).or_insert(0);
        let slug = if *count == 0 {
            base_slug.clone()
        } else {
            format!("{base_slug}-{count}")
        };
        *count += 1;

        if let Event::Start(PmTag::Heading {
            level: l,
            id: _,
            classes,
            attrs,
        }) = events[i].clone()
        {
            events[i] = Event::Start(PmTag::Heading {
                level: l,
                id: Some(CowStr::Boxed(slug.clone().into_boxed_str())),
                classes,
                attrs,
            });
        }

        headings.push(Heading {
            level: match level {
                HeadingLevel::H2 => 2,
                HeadingLevel::H3 => 3,
                _ => 2,
            },
            slug,
            text,
        });
        i = j + 1;
    }

    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, events.into_iter());
    Some((HtmlFragment::new(html_output), headings))
}

// CommonMark-friendly slugger: lowercase alphanumerics, single hyphens
// between word breaks, trimmed at both ends. Sufficient for stable
// anchor ids inside our own articles.
fn slugify(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut prev_dash = true;
    for c in text.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            prev_dash = false;
        } else if !prev_dash {
            out.push('-');
            prev_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

// Sidebar "on this page" navigation. Empty when the article has no h2/h3
// headings — the CSS hides the empty <aside> on small viewports anyway,
// but skipping the render here is cleaner. h3 entries get the .is-h3
// modifier for the indented sub-item treatment.
fn render_toc(headings: &[Heading]) -> HtmlFragment {
    if headings.is_empty() {
        return HtmlFragment::empty();
    }
    let items: HtmlFragment = headings
        .iter()
        .map(|h| {
            let class = if h.level == 3 {
                "article-toc-link is-h3"
            } else {
                "article-toc-link"
            };
            view! {
                <li>
                    <a class={ class } href={ format!("#{}", h.slug) }>
                        { h.text.clone() }
                    </a>
                </li>
            }
        })
        .collect();

    view! {
        <aside class="article-toc" aria-label="On this page">
            <div class="article-toc-heading">
                <svg class="article-toc-icon" viewBox="0 0 16 16" aria-hidden="true">
                    <g fill="none" stroke="currentColor" stroke-width="1.5"
                       stroke-linecap="round" stroke-linejoin="round">
                        <line x1="6" y1="4" x2="14" y2="4" />
                        <line x1="6" y1="8" x2="14" y2="8" />
                        <line x1="6" y1="12" x2="14" y2="12" />
                        <circle cx="3" cy="4" r="0.9" fill="currentColor" />
                        <circle cx="3" cy="8" r="0.9" fill="currentColor" />
                        <circle cx="3" cy="12" r="0.9" fill="currentColor" />
                    </g>
                </svg>
                "On this page"
            </div>
            <ul class="article-toc-list">{ items }</ul>
        </aside>
    }
}

