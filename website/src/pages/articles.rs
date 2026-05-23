use std::collections::HashMap;

use axum::extract::Path;
use axum::http::StatusCode;
use axum::response::Html;
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use pulldown_cmark::{CowStr, Event, HeadingLevel, Tag as PmTag, TagEnd};
use rust_embed::RustEmbed;

use super::{
    AVATAR_SRC, GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, avatar_srcset, nav_icon_discord,
    nav_icon_folder, nav_icon_github, render_dev_meta, render_discovery_toasts,
    render_global_search, render_nav_search_toggle, render_quick_actions, render_resource_hints,
    render_sfx_urls, render_sitemap_link,
};
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

#[repr(u8)]
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

    pub fn from_slug(slug: &str) -> Option<Self> {
        Self::ALL
            .iter()
            .copied()
            .find(|category| category.slug() == slug)
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

#[repr(u8)]
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
    Blender,
    ThreeDPrinting,
    Makerspace,
    Parenting,
}

impl Tag {
    pub const ALL: &'static [Tag] = &[
        Self::Ai,
        Self::ClaudeCode,
        Self::Rust,
        Self::Voice,
        Self::Mcp,
        Self::Discord,
        Self::Community,
        Self::Mentorship,
        Self::Lsp,
        Self::TypeScript,
        Self::DeveloperTooling,
        Self::Macros,
        Self::Framework,
        Self::JsxLike,
        Self::Workflow,
        Self::Solopreneur,
        Self::LocalFirst,
        Self::Blender,
        Self::ThreeDPrinting,
        Self::Makerspace,
        Self::Parenting,
    ];

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
            Self::Blender => "blender",
            Self::ThreeDPrinting => "3d-printing",
            Self::Makerspace => "makerspace",
            Self::Parenting => "parenting",
        }
    }

    pub fn slug(self) -> &'static str {
        self.label()
    }

    pub fn from_slug(slug: &str) -> Option<Self> {
        Self::ALL.iter().copied().find(|tag| tag.slug() == slug)
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
            Self::Blender => "🧊",
            Self::ThreeDPrinting => "🖨",
            Self::Makerspace => "🧰",
            Self::Parenting => "🧒",
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
    tags.iter().copied().filter(|t| seen.insert(*t)).collect()
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ArticleDate {
    pub year: i32,
    pub month: u8,
    pub day: u8,
}

impl ArticleDate {
    pub const fn new(year: i32, month: u8, day: u8) -> Self {
        Self { year, month, day }
    }

    pub fn label(self) -> String {
        format!("{} {}, {}", self.month_name(), self.day, self.year)
    }

    pub fn iso(self) -> String {
        format!("{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }

    fn month_name(self) -> &'static str {
        match self.month {
            1 => "January",
            2 => "February",
            3 => "March",
            4 => "April",
            5 => "May",
            6 => "June",
            7 => "July",
            8 => "August",
            9 => "September",
            10 => "October",
            11 => "November",
            12 => "December",
            _ => "Undated",
        }
    }
}

#[derive(Clone, Copy, Debug)]
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
    pub date: ArticleDate,
    pub summary: &'static str,
    /// Hidden articles are directly routable but excluded from public article
    /// surfaces and rendered with a robots noindex meta tag.
    pub indexed: bool,
    /// Primary section. Exactly one per article.
    pub category: Category,
    /// Free-form tags. Deduped to a set at render time via `unique_tags`.
    pub tags: &'static [Tag],
}

const ARTICLE_LIST: &[Article] = &[
    Article {
        slug: "project-foottraffic",
        title: "Project FootTraffic: A Real Estate Boom for Small Business",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 23),
        summary: "A startup sketch for turning local plazas into destinations: AI-assisted service design, regional operators, and a compounding platform funded one small business at a time.",
        indexed: true,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::Workflow,
            Tag::Solopreneur,
            Tag::LocalFirst,
            Tag::DeveloperTooling,
            Tag::Community,
        ],
    },
    Article {
        slug: "talking-not-typing",
        title: "I Ship Sites By Talking, Not Typing",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 17),
        summary: "I built three Rust projects this week without typing a single line of code. Voice → Claude Code → pull requests. The floor is rising for everyone.",
        indexed: true,
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
        date: ArticleDate::new(2026, 3, 14),
        summary: "Auteurs: a community of engineers, designers, and product managers shipping things that matter. Scan the QR or click through to join the Discord.",
        indexed: true,
        category: Category::Community,
        tags: &[Tag::Community, Tag::Discord, Tag::Mentorship],
    },
    Article {
        slug: "claude-code-lsp",
        title: "Claude Code now has LSP support. Here's why that actually matters for TypeScript & Rust devs.",
        title_alias: None,
        date: ArticleDate::new(2025, 12, 29),
        summary: "I asked Claude to refactor a function used in 47 places across our monorepo. grep found 31. With LSP, Claude found all 47.",
        indexed: true,
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
        date: ArticleDate::new(2025, 5, 31),
        summary: "Step one of a web framework experiment: building a JSX-like declarative macro in Rust with macro_rules!.",
        indexed: true,
        category: Category::FrameworkDesign,
        tags: &[Tag::Rust, Tag::Macros, Tag::Framework, Tag::JsxLike],
    },
    Article {
        slug: "mcp-blender-library-3d-print",
        title: "Making a tiny war-hammer hero with MCP, Blender, and a library 3D printer",
        title_alias: None,
        date: ArticleDate::new(2026, 5, 21),
        summary: "A parent-and-kid tutorial for using Codex or Claude Code, MCP, and Blender to design an original tiny hammer hero, validate it for FDM printing, and bring an STL to a public-library makerspace.",
        indexed: false,
        category: Category::Workflow,
        tags: &[
            Tag::Ai,
            Tag::ClaudeCode,
            Tag::Mcp,
            Tag::Blender,
            Tag::ThreeDPrinting,
            Tag::Makerspace,
            Tag::Parenting,
        ],
    },
];

pub const ARTICLES: &[Article] = ARTICLE_LIST;
const ARTICLE_COUNT: usize = ARTICLE_LIST.len();

pub fn public_articles() -> impl Iterator<Item = &'static Article> {
    ARTICLES.iter().filter(|article| article.indexed)
}

pub fn article_by_slug(slug: &str) -> Option<&'static Article> {
    ARTICLES.iter().find(|article| article.slug == slug)
}

pub fn article_markdown(slug: &str) -> Option<String> {
    let path = format!("{slug}.md");
    let file = ArticleSources::get(&path)?;
    std::str::from_utf8(&file.data).ok().map(str::to_owned)
}

#[derive(Clone, Copy, Debug)]
pub struct ArticleRelations {
    pub next: Option<usize>,
    pub topic_next: Option<usize>,
}

impl ArticleRelations {
    const EMPTY: Self = Self {
        next: None,
        topic_next: None,
    };
}

pub const ARTICLE_RELATIONS: [ArticleRelations; ARTICLE_COUNT] = build_article_relations();

pub fn relevance_score(current: &Article, candidate: &Article) -> u16 {
    relevance_score_articles(*current, *candidate)
}

const fn build_article_relations() -> [ArticleRelations; ARTICLE_COUNT] {
    let mut relations = [ArticleRelations::EMPTY; ARTICLE_COUNT];
    let mut index = 0;
    while index < ARTICLE_COUNT {
        let next = find_next_index(index);
        relations[index] = ArticleRelations {
            next,
            topic_next: find_topic_next_index(index, next),
        };
        index += 1;
    }
    relations
}

const fn find_next_index(current_index: usize) -> Option<usize> {
    if !ARTICLE_LIST[current_index].indexed {
        return None;
    }

    let mut index = current_index + 1;
    while index < ARTICLE_COUNT {
        if ARTICLE_LIST[index].indexed {
            return Some(index);
        }
        index += 1;
    }

    index = 0;
    while index < current_index {
        if ARTICLE_LIST[index].indexed {
            return Some(index);
        }
        index += 1;
    }

    None
}

const fn find_topic_next_index(current_index: usize, avoid_index: Option<usize>) -> Option<usize> {
    let current = ARTICLE_LIST[current_index];
    if !current.indexed {
        return None;
    }
    let mut best: Option<usize> = None;
    let mut best_score = 0;
    let mut index = 0;
    while index < ARTICLE_COUNT {
        let is_avoided = match avoid_index {
            Some(avoid) => index == avoid,
            None => false,
        };
        if ARTICLE_LIST[index].indexed && index != current_index && !is_avoided {
            let candidate = ARTICLE_LIST[index];
            let score = relevance_score_articles(current, candidate);
            if score > best_score || (score == best_score && topic_tie_breaker(candidate, best)) {
                best = Some(index);
                best_score = score;
            }
        }
        index += 1;
    }

    match best {
        Some(_) => return best,
        None => {}
    }

    match avoid_index {
        Some(_) => {}
        None => return None,
    }

    index = 0;
    while index < ARTICLE_COUNT {
        if ARTICLE_LIST[index].indexed && index != current_index {
            let candidate = ARTICLE_LIST[index];
            let score = relevance_score_articles(current, candidate);
            if score > best_score || (score == best_score && topic_tie_breaker(candidate, best)) {
                best = Some(index);
                best_score = score;
            }
        }
        index += 1;
    }

    best
}

const fn topic_tie_breaker(candidate: Article, best: Option<usize>) -> bool {
    match best {
        Some(best_index) => date_is_after(candidate.date, ARTICLE_LIST[best_index].date),
        None => true,
    }
}

const fn relevance_score_articles(current: Article, candidate: Article) -> u16 {
    let mut score = 0;
    if current.category as u8 == candidate.category as u8 {
        score += 10;
    }

    let mut index = 0;
    while index < current.tags.len() {
        if contains_tag(candidate.tags, current.tags[index]) {
            score += 3;
        }
        index += 1;
    }
    score
}

const fn contains_tag(tags: &[Tag], needle: Tag) -> bool {
    let mut index = 0;
    while index < tags.len() {
        if tags[index] as u8 == needle as u8 {
            return true;
        }
        index += 1;
    }
    false
}

const fn date_is_after(a: ArticleDate, b: ArticleDate) -> bool {
    a.year > b.year
        || (a.year == b.year && (a.month > b.month || (a.month == b.month && a.day > b.day)))
}

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

// Toolbar of API-driven actions in the article-meta header. Each
// button starts `hidden`; the corresponding experience in
// experiences.js un-hides it after a successful feature-detect, then
// wires the click handler. Unsupported buttons stay hidden so layout
// matches reality on every browser.
fn article_meta_tools() -> HtmlFragment {
    view! {
        <div class="article-meta-tools" aria-label="Article tools">
            <button class="article-meta-tool" type="button" data-share hidden>
                <span aria-hidden="true">"↗"</span>
                <span>"Share"</span>
            </button>
            <button class="article-meta-tool" type="button" data-read-aloud hidden>
                <span aria-hidden="true">"▶"</span>
                <span>"Read aloud"</span>
            </button>
            <button class="article-meta-tool" type="button" data-fullscreen hidden>
                <span aria-hidden="true">"⛶"</span>
                <span>"Fullscreen"</span>
            </button>
            <button class="article-meta-tool" type="button" data-eyedropper hidden>
                <span aria-hidden="true">"◉"</span>
                <span>"Recolor"</span>
            </button>
        </div>
    }
}

// Brutalist Web API Receipt modal. Opens on `?` key from anywhere on
// the site OR when `?receipt` is in the URL on load. Toggling the
// modal pushes/pops that query param so the state is deep-linkable.
// Static shell; the JS at js/experiences.js populates the stats +
// grid from the registry after runAll() finishes.
fn receipt_modal() -> HtmlFragment {
    view! {
        <aside id="api-receipt-modal" popover="manual" class="api-receipt">
            <div class="api-receipt-frame">
                <header class="api-receipt-head">
                    <span class="api-receipt-glyph" aria-hidden="true">"⌬"</span>
                    <h2 class="api-receipt-title">"Web API Receipt"</h2>
                    <div class="api-receipt-stats" data-api-receipt-stats></div>
                    <button class="api-receipt-close"
                            type="button"
                            popovertarget="api-receipt-modal"
                            popovertargetaction="hide"
                            aria-label="Close">
                        "✕"
                    </button>
                </header>
                <div class="api-receipt-grid" data-api-receipt-grid></div>
                <footer class="api-receipt-foot">
                    <span>"Press "<kbd>"?"</kbd>" to toggle · "<kbd>"Esc"</kbd>" to close · share with "<kbd>"?receipt"</kbd></span>
                </footer>
            </div>
        </aside>
    }
}

// Vercel-style dropdown trigger + panel containing the latest three
// articles. The trigger keeps the `.is-current` highlight so the nav
// reads identically to before for users on browsers without JS — the
// markup is still a clickable disclosure with all targets inside.
fn render_articles_dropdown() -> HtmlFragment {
    let items: HtmlFragment = public_articles()
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
                        <div class="nav-dropdown-item-date">{ a.date.label() }</div>
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
                    aria-expanded="false"
                    aria-label="Articles">
                { nav_icon_folder() }
                <span class="site-nav-link-label">"Articles"</span>
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

#[derive(Clone, Copy)]
struct ArticlePageAssets {
    region_map: bool,
}

impl ArticlePageAssets {
    const NONE: Self = Self { region_map: false };

    fn for_slug(slug: &str) -> Self {
        match slug {
            "project-foottraffic" => Self { region_map: true },
            _ => Self::NONE,
        }
    }
}

fn render_article_page_assets(assets: ArticlePageAssets) -> HtmlFragment {
    if !assets.region_map {
        return HtmlFragment::empty();
    }

    view! {
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <link rel="stylesheet" href={ asset_url("css/region-map.css") } />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
        <script src={ asset_url("js/region-map.js") } defer></script>
    }
}

fn layout(
    title: &str,
    body: HtmlFragment,
    indexed: bool,
    page_assets: ArticlePageAssets,
) -> HtmlFragment {
    let robots_meta = if indexed {
        HtmlFragment::empty()
    } else {
        view! {
            <meta name="robots" content="noindex,nofollow" />
        }
    };

    html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ title }</title>
                { robots_meta }
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/articles.css") } />
                <link rel="stylesheet" href={ asset_url("css/comments.css") } />
                { render_article_page_assets(page_assets) }
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script src={ asset_url("js/audio.js") } defer></script>
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
                <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
                <script src={ asset_url("js/search.js") } defer></script>
                <script src={ asset_url("js/search-keyclick.js") } defer></script>
                <script src={ asset_url("js/copy-code.js") } defer></script>
                <script src={ asset_url("js/auteurs-shader.js") } defer></script>
                <script src={ asset_url("js/comments.js") } defer></script>
                <script src={ asset_url("js/toc-waypoints.js") } defer></script>
                <script src={ asset_url("js/to-top.js") } defer></script>
                <script src={ asset_url("js/popover-registry.js") } defer></script>
                <script src={ asset_url("js/nav-dropdown.js") } defer></script>
                <script src={ asset_url("js/nav-search-toggle.js") } defer></script>
                <script src={ asset_url("js/view-transitions.js") } defer></script>
                <script src={ asset_url("js/quick-actions.js") } defer></script>
                <script>{ HtmlFragment::new(format!(
                    "window.__engUrls={{paintHatch:\"{}\",cryptoWorker:\"{}\"}};",
                    asset_url("js/paint-brutalist-hatch.js"),
                    asset_url("js/worker-crypto.js"),
                )) }</script>
                <script src={ asset_url("js/experiences.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#e64553" />
                { render_dev_meta() }
            </head>
            <body class="articles-page">
                <a class="skip-link" href="#main">"Skip to content"</a>
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
                    { render_global_search("Search") }
                    <div class="site-nav-links">
                        { render_nav_search_toggle() }
                        { render_articles_dropdown() }
                        <a class="site-nav-link" href="https://discord.gg/sTzQBrbnBM" target="_blank" rel="noopener" aria-label="Join the Discord">
                            { nav_icon_discord() }
                            <span class="site-nav-link-label">"Discord"</span>
                        </a>
                        <a class="site-nav-link" href="https://github.com/matthewharwood" target="_blank" rel="noopener" aria-label="View on GitHub">
                            { nav_icon_github() }
                            <span class="site-nav-link-label">"GitHub"</span>
                        </a>
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
                { render_quick_actions() }
                { render_discovery_toasts() }
                { receipt_modal() }
            </body>
        </html>
    }
}

pub async fn index() -> Html<String> {
    let entries: HtmlFragment = public_articles()
        .map(|a| {
            view! {
                <li class="article-entry">
                    <a class="article-entry-title" href={ format!("/articles/{}", a.slug) }>
                        { a.title }
                    </a>
                    <span class="article-entry-date">{ a.date.label() }</span>
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

    Html(
        layout(
            "Articles · engmanager.xyz",
            body,
            true,
            ArticlePageAssets::NONE,
        )
        .into_string(),
    )
}

fn render_article_navigation(current_index: usize) -> HtmlFragment {
    let relations = ARTICLE_RELATIONS[current_index];
    let next = relations
        .next
        .map(|index| render_next_article_card(current_index, index, "Article"))
        .unwrap_or_else(HtmlFragment::empty);
    let topic_next = relations
        .topic_next
        .map(|index| render_next_article_card(current_index, index, "By topic"))
        .unwrap_or_else(HtmlFragment::empty);

    if relations.next.is_none() && relations.topic_next.is_none() {
        return HtmlFragment::empty();
    }

    view! {
        <footer class="article-nextup" aria-label="Next articles">
            <nav class="article-next-grid" aria-label="Next articles">
                { next }
                { topic_next }
            </nav>
        </footer>
    }
}

fn render_next_article_card(
    current_index: usize,
    article_index: usize,
    context: &'static str,
) -> HtmlFragment {
    let current = &ARTICLES[current_index];
    let article = &ARTICLES[article_index];
    let title = article.title_alias.unwrap_or(article.title);
    let score = relevance_score(current, article);
    let chips = render_article_topic_chips(article);

    view! {
        <a class="article-next-card"
           href={ format!("/articles/{}", article.slug) }
           data-relevance-score={ format!("{}", score) }>
            <span class="article-next-kicker">"Next"</span>
            <span class="article-next-body">
                <span class="article-next-context">{ context }</span>
                <strong class="article-next-title">{ title }</strong>
                <span class="article-next-chips" aria-label="Article topics">
                    { chips }
                </span>
            </span>
            <span class="article-next-arrow" aria-hidden="true">"→"</span>
        </a>
    }
}

fn render_article_topic_chips(article: &Article) -> HtmlFragment {
    let tags: HtmlFragment = unique_tags(article.tags)
        .into_iter()
        .map(|tag| {
            view! {
                <span class="article-next-chip">{ tag.label() }</span>
            }
        })
        .collect();

    view! {
        <span class="article-next-chip article-next-chip-category">
            { article.category.label() }
        </span>
        { tags }
    }
}

// Marker in auteurs.md that gets string-replaced with the live Discord
// widget HTML at render time. Pulldown-cmark passes raw HTML blocks
// through verbatim, so the comment survives Markdown rendering.
const DISCORD_WIDGET_SENTINEL: &str = "<!--auteurs-discord-widget-->";
const FOOTTRAFFIC_MAP_SENTINEL: &str = "<!--foottraffic-map-->";

pub async fn detail(Path(slug): Path<String>) -> Result<Html<String>, StatusCode> {
    let article = ARTICLES.iter().position(|a| a.slug == slug);
    match article {
        Some(article_index) => {
            let a = &ARTICLES[article_index];
            // Article-page heading + browser <title> use title_alias when set.
            let page_title = a.title_alias.unwrap_or(a.title);
            let (inner, headings) =
                article_body(&slug).unwrap_or_else(|| (HtmlFragment::empty(), Vec::new()));
            let inner = splice_discord_widget(&slug, inner).await;
            let inner = splice_foottraffic_map(&slug, inner);
            let toc = render_toc(&headings);
            let vt_name = format!("view-transition-name: article-{slug}");
            let taxonomy = render_taxonomy(a.category, a.tags);
            let article_navigation = render_article_navigation(article_index);
            let page_assets = ArticlePageAssets::for_slug(&slug);
            let body = view! {
                <article id="main"
                         class="article"
                         tabindex="-1"
                         data-commentable-article
                         data-article-slug={ slug.clone() }>
                    <h1 class="article-title" style={ vt_name }>{ page_title }</h1>
                    <header class="article-meta">
                        <img class="article-meta-avatar"
                             src=AVATAR_SRC
                             srcset={ avatar_srcset(&[40, 80, 120]) }
                             sizes="40px"
                             alt="Matthew Harwood"
                             width="40"
                             height="40"
                             loading="eager"
                             decoding="async" />
                        <div class="article-meta-author">
                            <div class="article-meta-name">"Matthew Harwood"</div>
                            <div class="article-meta-role">"Engineering Manager @ Uber"</div>
                        </div>
                        <time class="article-meta-date" datetime={ a.date.iso() }>
                            { a.date.label() }
                        </time>
                        <details class="article-meta-disclosure article-meta-disclosure-tools">
                            <summary class="article-meta-summary">"Actions"</summary>
                            { article_meta_tools() }
                        </details>
                        { taxonomy }
                    </header>
                    { inner }
                    { article_navigation }
                </article>
                <section class="comments-panel"
                         id="comments"
                         data-comments-panel
                         data-article-slug={ slug.clone() }
                         aria-label="Article comments">
                    <header class="comments-panel-head">
                        <h2>"Comments"</h2>
                        <p>"Select text in the article to leave an inline comment."</p>
                    </header>
                    <div class="comments-list" data-comments-list aria-live="polite"></div>
                </section>
                { toc }
            };
            Ok(Html(
                layout(page_title, body, a.indexed, page_assets).into_string(),
            ))
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

fn splice_foottraffic_map(slug: &str, body: HtmlFragment) -> HtmlFragment {
    let body_str = body.as_str();
    if !body_str.contains(FOOTTRAFFIC_MAP_SENTINEL) {
        return body;
    }
    let replacement = if slug == "project-foottraffic" {
        render_foottraffic_map().into_string()
    } else {
        String::new()
    };
    HtmlFragment::new(body_str.replace(FOOTTRAFFIC_MAP_SENTINEL, &replacement))
}

fn render_foottraffic_map() -> HtmlFragment {
    let config = r#"{
  "label": "Project FootTraffic regional operators",
  "center": [39.8283, -98.5795],
  "zoom": 4,
  "minZoom": 3,
  "maxZoom": 12,
  "pins": [
    {
      "name": "Matthew",
      "role": "Portland operator",
      "city": "Portland, Oregon",
      "coords": [45.5152, -122.6784],
      "radiusMiles": 160
    },
    {
      "name": "Marcus",
      "role": "LA operator",
      "city": "Los Angeles, California",
      "coords": [34.0522, -118.2437],
      "radiusMiles": 180
    },
    {
      "name": "Jason",
      "role": "Austin operator",
      "city": "Austin, Texas",
      "coords": [30.2672, -97.7431],
      "radiusMiles": 170
    },
    {
      "name": "Alex",
      "role": "Detroit operator",
      "city": "Detroit, Michigan",
      "coords": [42.3314, -83.0458],
      "radiusMiles": 160
    }
  ]
}"#;

    view! {
        <figure class="region-map" data-region-map aria-labelledby="foottraffic-map-title">
            <div class="region-map-copy">
                <h2 id="foottraffic-map-title">"Regional Operator Map"</h2>
                <p>
                    "A first pass at the territory model: one operator per region, with the same map module ready for later heat-map and blast-radius layers."
                </p>
            </div>
            <div class="region-map-shell">
                <div class="region-map-canvas"
                     data-region-map-canvas
                     role="application"
                     tabindex="0"
                     aria-label="Interactive map of Project FootTraffic operators"></div>
                <div class="region-map-poster" data-region-map-poster>
                    <img src={ asset_url("foottraffic-map-poster.svg") }
                         alt=""
                         width="1200"
                         height="675"
                         loading="eager"
                         decoding="async" />
                    <div class="region-map-status" data-region-map-status role="status">
                        "Loading interactive map"
                    </div>
                </div>
            </div>
            <figcaption>
                "Pins show Matthew in Portland, Marcus in Los Angeles, Jason in Austin, and Alex in Detroit."
            </figcaption>
            <script type="application/json" data-region-map-config>
                { HtmlFragment::new(config.to_string()) }
            </script>
            <noscript>
                <p>
                    "Map locations: Matthew in Portland, Marcus in Los Angeles, Jason in Austin, and Alex in Detroit."
                </p>
            </noscript>
        </figure>
    }
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
