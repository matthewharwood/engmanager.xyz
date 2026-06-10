use std::collections::HashMap;
use std::sync::LazyLock;

use axum::extract::{Path, State};
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::view;
use pulldown_cmark::{CowStr, Event, HeadingLevel, Tag as PmTag, TagEnd};

use super::shell::{MetaTags, PageShell, json_ld_island, json_str_escape};
use super::{
    AVATAR_SRC, avatar_srcset, render_experience_urls, render_liquid_title_filter,
    render_nav_search_toggle,
};
use crate::AppState;
use crate::asset_url;
use crate::components::article_toc::{self, Heading};
use crate::components::{
    Head, api_receipt, discord_widget, discovery_toasts, global_search, nav, quick_actions,
    region_map, to_top,
};
use crate::config::SITE_ORIGIN;
use crate::content::{
    ARTICLE_RELATIONS, ARTICLES, Article, Category, Tag, article_markdown, public_articles,
    relevance_score, unique_tags,
};
use crate::discord::DiscordSnapshot;

const ARTICLE_REVEAL_VARIANTS: [&str; 5] = ["rise", "drift", "hinge", "focus", "thread"];

/// Articles-index meta description (ledger #3 additive SEO head).
const INDEX_DESCRIPTION: &str = "All articles from ENG MANAGER — engineering leadership, AI-assisted workflows, Rust, frameworks, and developer tooling, newest first.";

/// Meta descriptions aim for this many characters, truncated at a word
/// boundary with a trailing ellipsis (classic SERP snippet budget).
const META_DESCRIPTION_TARGET_CHARS: usize = 155;

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

// The Web API Receipt modal moved to the co-located component
// `components/api_receipt/` (ledger #4: one pure render for the copy that
// lived here and the verbatim twin in pages/homepage.rs).

// The "Articles" nav dropdown moved into the co-located nav component
// (`components/nav/`). `layout()` hoists the latest-three article rows into
// `nav::Articles::Dropdown` so the component's render stays pure.

// ArticlePageAssets (the per-page asset flag struct) was retired in P4:
// `layout` now owns the detail-surface page assets (liquid-title +
// section-reveal — page-level flat assets for now) and `detail()` composes
// the per-slug extras (the region-map head block) into an extra `Head`.

// Inline `<head>` bootstrap for the one-time section reveal (detail surface
// only). Stays a raw fragment: it must run before first paint.
fn render_article_reveal_bootstrap() -> HtmlFragment {
    HtmlFragment::new(
        r#"<script>try{if(!location.hash&&"IntersectionObserver"in window&&!matchMedia("(prefers-reduced-motion: reduce)").matches){document.documentElement.dataset.articleReveal="pending";setTimeout(function(){if(document.documentElement.dataset.articleReveal==="pending"){document.documentElement.dataset.articleReveal="fallback"}},2500)}}catch(_){}</script>"#
            .to_string(),
    )
}

fn render_article_title(title: &str, vt_name: &str) -> HtmlFragment {
    view! {
        { render_liquid_title_filter() }
        <h1 class="article-title liquid-title"
            style={ vt_name }
            data-liquid-title
            data-liquid-title-text={ title }>
            { title }
        </h1>
    }
}

/// Which article surface is being laid out. The index drops every
/// detail-only asset (ledger #5): comments.css, the Prism CDN pair,
/// comments.js, copy-code.js, toc-waypoints.js, and auteurs-shader.js.
#[derive(Clone, Copy, PartialEq)]
enum Surface {
    Index,
    Detail,
}

fn layout(
    title: &str,
    body: HtmlFragment,
    meta: MetaTags,
    extra_assets: Head,
    surface: Surface,
    speculation: bool,
) -> String {
    let detail = surface == Surface::Detail;

    // Hoist the latest-three article rows out of the (pure) nav component so it
    // never touches `public_articles()`/`asset_url` itself. Article pages always
    // render the dropdown config.
    let nav_dropdown_items: Vec<nav::DropdownItem> = public_articles()
        .take(3)
        .map(|a| nav::DropdownItem {
            display: a.title_alias.unwrap_or(a.title).to_string(),
            slug: a.slug.to_string(),
            date_label: a.date.label().to_string(),
        })
        .collect();
    let nav = nav::render(nav::Props {
        brand_icon_url: asset_url("favicon.svg"),
        global_search: global_search::render(global_search::Props {
            placeholder: "Search",
        }),
        search_toggle: render_nav_search_toggle(),
        articles: nav::Articles::Dropdown(nav_dropdown_items),
    });

    // Discovery-toast overlay: container + its async (deferred) styles.
    let toasts = discovery_toasts::render();
    let to_top = to_top::render(Default::default());
    // Receipt modal (ledger #4 dedup) + quick-actions cluster. Their
    // stylesheets are emitted by PageShell right after critical.css (ledger
    // #8); the add()s below are byte-neutral dep declarations that global
    // dedup collapses into those (the cluster's FAB script still lands here).
    let receipt = api_receipt::render();
    let quick_actions = quick_actions::render();

    let mut assets = Head::new();
    assets.add_css("css/articles.css");
    // Splits out of articles.css (ledger #8): emitted immediately after it,
    // in the order the rule blocks occupied inside the file, on BOTH surfaces
    // (the index loaded these rules via articles.css too — per-page selector
    // sets stay unchanged). The widget/toc markup renders per page as before.
    assets.add_css(discord_widget::STYLE);
    assets.add_css(article_toc::STYLE);
    if detail {
        assets.add_css("css/comments.css");
        // Detail-surface page assets (formerly ArticlePageAssets flags —
        // every detail page sets both): the liquid-title effect and the
        // one-time section reveal. Page-level flat assets for now.
        assets.add_css("css/liquid-title.css");
        assets.add_js("js/liquid-title.js");
        assets.add_js("js/article-section-reveal.js");
    }
    // Per-slug extras composed by the caller (the region-map head block on
    // project-foottraffic); empty for the index and every other slug.
    assets.extend(extra_assets);

    let mut scripts = Head::new();
    scripts.add_js("js/audio.js");
    if detail {
        scripts.add_inline(view! {
            <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-core.min.js" defer></script>
            <script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/plugins/autoloader/prism-autoloader.min.js" defer></script>
        });
    }
    scripts.add_js("js/search.js");
    scripts.add_js("js/search-keyclick.js");
    if detail {
        scripts.add_js("js/copy-code.js");
        scripts.add_js("js/auteurs-shader.js");
        scripts.add_js("js/comments.js");
        // The TOC scrollspy (formerly flat js/toc-waypoints.js) keeps its
        // exact head position; its stylesheet is pinned after articles.css
        // in the assets section above, so only the script lands here.
        scripts.add_js(article_toc::SCRIPT);
    }
    scripts.add(&to_top);
    scripts.add(&nav);
    scripts.add(&toasts);
    scripts.add(&receipt);
    scripts.add_js("js/view-transitions.js");
    scripts.add(&quick_actions);
    scripts.add_inline(render_experience_urls());
    scripts.add_js("js/experiences.js");

    let nav_markup = nav.markup;
    let toasts_markup = toasts.markup;
    let to_top_markup = to_top.markup;
    let receipt_markup = receipt.markup;
    let quick_actions_markup = quick_actions.markup;
    let page_body = view! {
        { nav_markup }
        { body }
        { to_top_markup }
        { quick_actions_markup }
        { toasts_markup }
        { receipt_markup }
    };

    let reveal_bootstrap = if detail {
        render_article_reveal_bootstrap()
    } else {
        HtmlFragment::empty()
    };

    PageShell::new(title, "articles-page")
        .meta(meta)
        .raw_meta(reveal_bootstrap)
        .assets(assets)
        .scripts(scripts)
        .speculation_rules(speculation)
        // Both article surfaces are router-eligible (ledger #16) — hidden
        // articles included: router eligibility is by path shape, while
        // `speculation` stays an indexability concern.
        .nav_router(true)
        .render(page_body)
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

    let meta = MetaTags {
        description: Some(INDEX_DESCRIPTION.to_string()),
        canonical: Some(format!("{SITE_ORIGIN}/articles/")),
        ..MetaTags::default()
    };

    Html(layout(
        "Articles · engmanager.xyz",
        body,
        meta,
        Head::new(),
        Surface::Index,
        true,
    ))
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

/// Everything derived from one article's Markdown in a single pass: the
/// rendered body, the TOC headings, and the SEO meta description (ledger #3).
#[derive(Clone)]
struct PreparedArticle {
    body: String,
    headings: Vec<Heading>,
    description: Option<String>,
}

// Startup-memoized article render cache: slug → PreparedArticle, built once
// from ARTICLES through the same `prepare_article` pipeline requests use.
// Release builds serve from this map (the per-request Discord/foottraffic
// splices still run on a clone, so live-widget behavior is unchanged); debug
// builds bypass it entirely so rust-embed's disk reads keep the .md live-edit
// loop. Building the map panics on a missing/corrupt .md — forced at startup
// in main(), that turns a registry↔files mismatch into a boot failure instead
// of an empty page.
static RENDERED_ARTICLES: LazyLock<HashMap<&'static str, PreparedArticle>> = LazyLock::new(|| {
    ARTICLES
        .iter()
        .map(|article| {
            let prepared = prepare_article(article.slug).unwrap_or_else(|| {
                panic!(
                    "article `{slug}` is registered in ARTICLES but articles/{slug}.md is missing or failed to render",
                    slug = article.slug
                )
            });
            (article.slug, prepared)
        })
        .collect()
});

/// Force the article render cache at startup (release builds only — debug
/// builds render per request for the live-edit loop). Called from `main()` so
/// a missing or corrupt embedded `.md` fails fast at boot; this doubles as the
/// `ARTICLES` ↔ `articles/*.md` parity check.
pub fn warm_article_render_cache() {
    if !cfg!(debug_assertions) {
        LazyLock::force(&RENDERED_ARTICLES);
    }
}

pub async fn detail(State(state): State<AppState>, Path(slug): Path<String>) -> Response {
    let article = ARTICLES.iter().position(|a| a.slug == slug);
    match article {
        Some(article_index) => {
            let a = &ARTICLES[article_index];
            // Article-page heading + browser <title> use title_alias when set.
            let page_title = a.title_alias.unwrap_or(a.title);
            // Release: clone the startup-rendered body/headings/description
            // from the cache. Debug: render from disk per request (live-edit
            // loop). A registered slug whose Markdown won't render is a 404 —
            // never an empty 200.
            let prepared = if cfg!(debug_assertions) {
                prepare_article(&slug)
            } else {
                RENDERED_ARTICLES.get(slug.as_str()).cloned()
            };
            let Some(PreparedArticle {
                body,
                headings,
                description,
            }) = prepared
            else {
                return super::not_found::response();
            };
            let inner = HtmlFragment::new(body);
            // The Discord snapshot is read from the AppState watch channel
            // here in the handler and hoisted into the splice (component
            // renders stay pure — no global reads below this point).
            let inner = splice_discord_widget(&slug, inner, state.discord.borrow().clone());
            let inner = splice_foottraffic_map(&slug, inner);
            // TOC component: the markup mounts below; its CSS/JS deps are
            // pinned at their pre-P4 head positions inside `layout`.
            let toc = article_toc::render(&headings).markup;
            let vt_name = format!("view-transition-name: article-{slug}");
            let taxonomy = render_taxonomy(a.category, a.tags);
            let article_navigation = render_article_navigation(article_index);
            let extra_assets = foottraffic_map_assets(&slug);
            let title = render_article_title(page_title, &vt_name);
            let body = view! {
                <article id="main"
                         class="article"
                         tabindex="-1"
                         data-commentable-article
                         data-article-slug={ slug.clone() }>
                    { title }
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
            // Hidden articles keep robots noindex,nofollow and gain NO
            // canonical/og/JSON-LD (ledger #3 is additive for indexed pages
            // only); indexed articles get the full SEO head.
            let meta = if a.indexed {
                let url = format!("{SITE_ORIGIN}/articles/{slug}");
                MetaTags {
                    description,
                    canonical: Some(url.clone()),
                    og_title: Some(page_title.to_string()),
                    og_type: Some("article"),
                    og_image: Some(AVATAR_SRC),
                    og_url: Some(url.clone()),
                    published_time: Some(a.date.iso()),
                    twitter_card: Some("summary"),
                    json_ld: vec![article_json_ld(page_title, &a.date.iso(), &url)],
                    ..MetaTags::default()
                }
            } else {
                MetaTags {
                    robots: Some("noindex,nofollow"),
                    ..MetaTags::default()
                }
            };
            Html(layout(
                page_title,
                body,
                meta,
                extra_assets,
                Surface::Detail,
                a.indexed,
            ))
            .into_response()
        }
        None => super::not_found::response(),
    }
}

/// JSON-LD `Article` object for an indexed article detail page.
fn article_json_ld(headline: &str, date_iso: &str, url: &str) -> HtmlFragment {
    json_ld_island(&format!(
        r#"{{"@context":"https://schema.org","@type":"Article","headline":"{}","datePublished":"{date_iso}","author":{{"@type":"Person","name":"matthew harwood"}},"mainEntityOfPage":"{}"}}"#,
        json_str_escape(headline),
        json_str_escape(url),
    ))
}

// Renders the live Discord widget into the body HTML if the article has
// a `<!--auteurs-discord-widget-->` sentinel and we have a fresh snapshot
// (hoisted from the AppState watch channel by the handler). When the
// snapshot is cold or the article doesn't reference the widget, the
// sentinel is dropped (empty string) and the article's static fallback
// (QR code + invite link) remains as the join CTA.
fn splice_discord_widget(
    slug: &str,
    body: HtmlFragment,
    snapshot: Option<DiscordSnapshot>,
) -> HtmlFragment {
    let body_str = body.as_str();
    if !body_str.contains(DISCORD_WIDGET_SENTINEL) {
        return body;
    }
    let replacement = match snapshot {
        Some(snap) if slug == "auteurs" => discord_widget::render(&snap).markup.into_string(),
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
        // The map figure moved to the co-located component
        // `components/region_map/`; the hashed poster URL is hoisted here so
        // the component render stays pure.
        region_map::render(region_map::Props {
            poster_url: asset_url("foottraffic-map-poster.svg"),
        })
        .markup
        .into_string()
    } else {
        String::new()
    };
    HtmlFragment::new(body_str.replace(FOOTTRAFFIC_MAP_SENTINEL, &replacement))
}

// Per-slug head extras for the region map (project-foottraffic only): the
// preconnects + poster preload + Leaflet CDN pair stay page-level inline
// fragments, with the component's own CSS/JS pinned at the flat files' old
// positions between them.
//
// ORDERING CONSTRAINT: the Leaflet CDN script MUST precede c-region-map.js.
// CDN URLs cannot be `js_deps` (those are asset_url dist paths), so the
// ordering is encoded here by emitting the inline CDN tag immediately before
// `region_map::SCRIPT`.
fn foottraffic_map_assets(slug: &str) -> Head {
    let mut extras = Head::new();
    if slug != "project-foottraffic" {
        return extras;
    }
    let poster_url = asset_url("foottraffic-map-poster.svg");
    let poster_preload = HtmlFragment::new(format!(
        r#"<link rel="preload" as="image" href="{poster_url}">"#
    ));
    extras.add_inline(view! {
        <link rel="preconnect" href="https://unpkg.com" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" />
        { poster_preload }
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    });
    extras.add_css(region_map::STYLE);
    extras.add_inline(view! {
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" defer></script>
    });
    extras.add_js(region_map::SCRIPT);
    extras
}

// The `Heading` data shape moved to the co-located component
// `components/article_toc/` (its render input, hoisted by this pipeline).

// Loads the Markdown for an article slug, parses it with pulldown-cmark,
// assigns an `id` to each h2/h3 (so the sidebar TOC can scroll-anchor to
// them), and returns the rendered HTML alongside the heading list and the
// derived meta description — one source pass for everything the detail page
// needs. The h1 from the article title is rendered by the outer layout, not
// the Markdown, so headings here start at h2.
fn prepare_article(slug: &str) -> Option<PreparedArticle> {
    let markdown = article_markdown(slug)?;

    let parser = pulldown_cmark::Parser::new_ext(&markdown, markdown_options());
    let mut events: Vec<Event> = parser.collect();
    let headings = extract_headings(&mut events);

    let events = wrap_article_reveal_sections(events);

    let mut html_output = String::new();
    pulldown_cmark::html::push_html(&mut html_output, events.into_iter());
    Some(PreparedArticle {
        body: html_output,
        headings,
        description: derive_meta_description(&markdown),
    })
}

fn markdown_options() -> pulldown_cmark::Options {
    let mut options = pulldown_cmark::Options::empty();
    options.insert(pulldown_cmark::Options::ENABLE_TABLES);
    options.insert(pulldown_cmark::Options::ENABLE_STRIKETHROUGH);
    options.insert(pulldown_cmark::Options::ENABLE_TASKLISTS);
    options.insert(pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES);
    options
}

// Meta description: the first non-heading paragraph of the Markdown with all
// Markdown syntax stripped (the event stream's text content — emphasis, link,
// and code markers never reach the output), whitespace collapsed, truncated
// at a word boundary near the SERP budget with a trailing ellipsis.
fn derive_meta_description(markdown: &str) -> Option<String> {
    let parser = pulldown_cmark::Parser::new_ext(markdown, markdown_options());
    let mut heading_depth: usize = 0;
    let mut image_depth: usize = 0;
    let mut in_paragraph = false;
    let mut text = String::new();
    for event in parser {
        match event {
            Event::Start(PmTag::Heading { .. }) => heading_depth += 1,
            Event::End(TagEnd::Heading(_)) => heading_depth = heading_depth.saturating_sub(1),
            // Image ALT text arrives as Text events between Start(Image) and
            // End(Image). It belongs to the image, not the prose — collecting
            // it would make an image-only opener masquerade as a description,
            // so it is excluded (this is what "the event stream's text
            // content" above always intended).
            Event::Start(PmTag::Image { .. }) => image_depth += 1,
            Event::End(TagEnd::Image) => image_depth = image_depth.saturating_sub(1),
            Event::Start(PmTag::Paragraph) if heading_depth == 0 => {
                in_paragraph = true;
                text.clear();
            }
            Event::End(TagEnd::Paragraph) if in_paragraph => {
                in_paragraph = false;
                let candidate = text.split_whitespace().collect::<Vec<_>>().join(" ");
                // Skip empty paragraphs (e.g. image-only) and keep scanning.
                if !candidate.is_empty() {
                    return Some(truncate_at_word_boundary(
                        &candidate,
                        META_DESCRIPTION_TARGET_CHARS,
                    ));
                }
            }
            Event::Text(t) | Event::Code(t) if in_paragraph && image_depth == 0 => {
                text.push_str(&t);
            }
            Event::SoftBreak | Event::HardBreak if in_paragraph => text.push(' '),
            _ => {}
        }
    }
    None
}

// Truncate to at most `max_chars` characters, backing up to the last word
// boundary, trimming dangling punctuation, and appending an ellipsis. Short
// inputs pass through untouched.
fn truncate_at_word_boundary(text: &str, max_chars: usize) -> String {
    let Some((cut_byte, _)) = text.char_indices().nth(max_chars) else {
        return text.to_string();
    };
    let head = &text[..cut_byte];
    let head = match head.rfind(char::is_whitespace) {
        Some(ws) => &head[..ws],
        None => head,
    };
    format!(
        "{}…",
        head.trim_end_matches([' ', ',', ';', ':', '.', '—', '-'])
    )
}

// Walks the event stream, anchoring every h2/h3 and collecting the sidebar
// heading list. Auto headings (id: None) get a slugified, dedup-counted id
// written back into the event; explicit `{#custom-id}` headings keep their id
// verbatim (pulldown-cmark already renders it) and never touch the dedup
// counters, so neighboring auto-ids are numbered exactly as before.
fn extract_headings(events: &mut [Event<'_>]) -> Vec<Heading> {
    let mut headings: Vec<Heading> = Vec::new();
    let mut slug_counts: HashMap<String, u32> = HashMap::new();

    let mut i = 0;
    while i < events.len() {
        let (level, explicit_id) = match &events[i] {
            Event::Start(PmTag::Heading {
                level: l @ (HeadingLevel::H2 | HeadingLevel::H3),
                id,
                ..
            }) => (*l, id.clone()),
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

        let slug = match explicit_id {
            // Explicit id: pulldown-cmark already renders it on the heading
            // element, so the event is left untouched.
            Some(id) => id.to_string(),
            None => {
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
                slug
            }
        };

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

    headings
}

fn wrap_article_reveal_sections(events: Vec<Event>) -> Vec<Event> {
    if events.is_empty() {
        return events;
    }

    let event_count = events.len();
    let mut sections: Vec<Vec<Event>> = Vec::new();
    let mut current: Vec<Event> = Vec::new();
    let mut section_started = false;

    for event in events {
        if is_reveal_section_heading(&event) && section_started {
            sections.push(current);
            current = Vec::new();
        } else if !section_started && starts_visible_article_content(&event) {
            section_started = true;
        }

        if section_started {
            current.push(event);
        }
    }

    if !current.is_empty() {
        sections.push(current);
    }

    let mut wrapped = Vec::with_capacity(event_count + 16);
    for (index, section) in sections.into_iter().enumerate() {
        let preload = section.iter().any(is_preloaded_embed_event);
        wrapped.push(reveal_section_start(index, preload));
        wrapped.extend(section);
        wrapped.push(reveal_section_end());
    }

    wrapped
}

fn is_reveal_section_heading(event: &Event) -> bool {
    matches!(
        event,
        Event::Start(PmTag::Heading {
            level: HeadingLevel::H2 | HeadingLevel::H3,
            ..
        })
    )
}

fn starts_visible_article_content(event: &Event) -> bool {
    !matches!(event, Event::SoftBreak | Event::HardBreak)
}

fn is_preloaded_embed_event(event: &Event) -> bool {
    match event {
        Event::Html(html) => {
            let html = html.as_ref();
            html.contains(FOOTTRAFFIC_MAP_SENTINEL)
                || html.contains("data-region-map")
                || html.contains("<iframe")
        }
        _ => false,
    }
}

fn reveal_section_start(index: usize, preload: bool) -> Event<'static> {
    let variant = ARTICLE_REVEAL_VARIANTS[index % ARTICLE_REVEAL_VARIANTS.len()];
    let preload_attr = if preload { " data-reveal-preload" } else { "" };
    Event::Html(CowStr::Boxed(
        format!(
            r#"<section class="article-reveal-section" data-article-reveal data-reveal-variant="{variant}" data-reveal-order="{index}"{preload_attr}>"#
        )
        .into_boxed_str(),
    ))
}

fn reveal_section_end() -> Event<'static> {
    Event::Html(CowStr::Borrowed("</section>"))
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

// The sidebar "on this page" render moved to the co-located component
// `components/article_toc/` (markup + styles + the waypoints scrollspy).

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn article_body_marks_sections_for_one_time_reveal() {
        let PreparedArticle { body, headings, .. } =
            prepare_article("project-foottraffic").expect("article body");
        let html = body.as_str();

        assert!(
            html.contains(r#"class="article-reveal-section""#),
            "article body should render section reveal wrappers",
        );
        assert!(
            html.contains(r#"data-reveal-variant="rise""#)
                && html.contains(r#"data-reveal-variant="drift""#)
                && html.contains(r#"data-reveal-variant="hinge""#)
                && html.contains(r#"data-reveal-variant="focus""#)
                && html.contains(r#"data-reveal-variant="thread""#),
            "section reveal variants should cycle through all five animation recipes",
        );
        assert!(
            html.contains("data-reveal-preload"),
            "sections with heavy embedded UI should be preloaded instead of reveal-animated",
        );

        let wrapper_count = html.matches("data-article-reveal").count();
        assert_eq!(
            wrapper_count,
            headings.len() + 1,
            "intro copy plus each h2/h3 section should get exactly one reveal wrapper",
        );
    }

    #[test]
    fn explicit_heading_ids_join_the_toc_verbatim() {
        // `{#custom-id}` headings must keep their id verbatim AND appear in
        // the heading list, without disturbing the dedup counters used by
        // neighboring auto-slugged headings.
        let markdown = "intro\n\n## Alpha\n\n## Custom {#custom-id}\n\n## Alpha\n";
        let mut options = pulldown_cmark::Options::empty();
        options.insert(pulldown_cmark::Options::ENABLE_HEADING_ATTRIBUTES);
        let mut events: Vec<Event> = pulldown_cmark::Parser::new_ext(markdown, options).collect();

        let headings = extract_headings(&mut events);
        let mut rendered = String::new();
        pulldown_cmark::html::push_html(&mut rendered, events.into_iter());

        let slugs: Vec<&str> = headings.iter().map(|h| h.slug.as_str()).collect();
        assert_eq!(slugs, ["alpha", "custom-id", "alpha-1"]);
        assert!(rendered.contains(r#"<h2 id="custom-id">"#));
        assert!(rendered.contains(r#"<h2 id="alpha">"#));
        assert!(rendered.contains(r#"<h2 id="alpha-1">"#));
    }

    #[test]
    fn meta_description_strips_markdown_and_skips_headings() {
        let markdown = "## Intro heading\n\nThis **first** paragraph links to \
                        [the docs](https://example.com) and mentions `code`.\n\nSecond paragraph.";
        assert_eq!(
            derive_meta_description(markdown).as_deref(),
            Some("This first paragraph links to the docs and mentions code."),
        );
    }

    #[test]
    fn meta_description_skips_image_alt_text() {
        // An image-only opener (alt text is NOT prose) must be skipped in
        // favor of the first real paragraph; alt text inside a mixed
        // paragraph must not leak into the description either.
        let markdown = "![A decorative hero image](/assets/hero.png)\n\nReal first paragraph.";
        assert_eq!(
            derive_meta_description(markdown).as_deref(),
            Some("Real first paragraph."),
        );

        let markdown = "Before ![inline alt](/a.png) after.";
        assert_eq!(
            derive_meta_description(markdown).as_deref(),
            Some("Before after."),
        );
    }

    #[test]
    fn meta_description_truncates_at_word_boundary_with_ellipsis() {
        let long = "word ".repeat(60); // 300 chars, far past the budget
        let description = derive_meta_description(&long).expect("description");
        assert!(description.ends_with('…'), "got: {description}");
        let chars = description.chars().count();
        assert!(
            chars <= META_DESCRIPTION_TARGET_CHARS + 1,
            "description too long: {chars} chars"
        );
        // Word-boundary cut: no split token like "wor…".
        assert!(description.trim_end_matches('…').ends_with("word"));
    }

    #[test]
    fn every_registered_article_derives_a_description() {
        for article in ARTICLES {
            let prepared = prepare_article(article.slug).expect("prepared article");
            let description = prepared
                .description
                .unwrap_or_else(|| panic!("article `{}` has no description", article.slug));
            assert!(!description.is_empty());
            assert!(description.chars().count() <= META_DESCRIPTION_TARGET_CHARS + 1);
        }
    }
}
