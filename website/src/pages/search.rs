use axum::Json;
use axum::extract::{Query, RawQuery, State};
use axum::http::{StatusCode, header};
use axum::response::{Html, IntoResponse, Response};
use eng_domain::HtmlFragment;
use eng_markup::{html, view};
use serde::Deserialize;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_global_search,
    render_nav_search_toggle, render_resource_hints, render_sfx_urls, render_sitemap_link,
};
use crate::AppState;
use crate::asset_url;
use crate::components::nav;
use crate::pages::articles::{Category, Tag};
use crate::search::{
    ArticleSearchHit, CommentSearchHit, ProductSearchHit, SearchQuery, SearchResults,
    all_indexed_article_tags, parse_article_date,
};

#[derive(Debug, Deserialize)]
pub struct TypeaheadParams {
    #[serde(default)]
    q: String,
}

#[derive(Debug, Default, Deserialize)]
pub struct SearchParams {
    #[serde(default)]
    q: String,
    #[serde(default)]
    category: Vec<String>,
    #[serde(default)]
    tag: Vec<String>,
    from: Option<String>,
    to: Option<String>,
    page: Option<usize>,
}

pub async fn typeahead(
    State(state): State<AppState>,
    Query(params): Query<TypeaheadParams>,
) -> Response {
    no_store(Json(state.search.typeahead(&params.q, 8))).into_response()
}

pub async fn page(State(state): State<AppState>, RawQuery(raw_query): RawQuery) -> Response {
    let params = SearchParams::from_raw_query(raw_query.as_deref().unwrap_or_default());
    let search_query = params.to_search_query();
    match state.search.search(&search_query) {
        Ok(results) => no_store(render_page(&params, &search_query, &results)).into_response(),
        Err(error) => {
            eprintln!("search page failed: {error:?}");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                [(header::CACHE_CONTROL, "no-store")],
                "Search is unavailable",
            )
                .into_response()
        }
    }
}

impl SearchParams {
    fn from_raw_query(raw_query: &str) -> SearchParams {
        let mut params = SearchParams::default();
        for pair in raw_query.split('&').filter(|pair| !pair.is_empty()) {
            let (key, value) = pair.split_once('=').unwrap_or((pair, ""));
            let key = query_decode(key);
            let value = query_decode(value);
            match key.as_str() {
                "q" => params.q = value,
                "category" if !value.is_empty() => params.category.push(value),
                "tag" if !value.is_empty() => params.tag.push(value),
                "from" if !value.is_empty() => params.from = Some(value),
                "to" if !value.is_empty() => params.to = Some(value),
                "page" => params.page = value.parse().ok(),
                _ => {}
            }
        }
        params
    }

    fn to_search_query(&self) -> SearchQuery {
        SearchQuery {
            q: self.q.clone(),
            categories: self
                .category
                .iter()
                .filter_map(|slug| Category::from_slug(slug))
                .collect(),
            tags: self
                .tag
                .iter()
                .filter_map(|slug| Tag::from_slug(slug))
                .collect(),
            date_from: self.from.as_deref().and_then(parse_article_date),
            date_to: self.to.as_deref().and_then(parse_article_date),
            page: self.page.unwrap_or(1).max(1),
        }
    }
}

fn render_page(
    params: &SearchParams,
    search_query: &SearchQuery,
    results: &SearchResults,
) -> Html<String> {
    let title = if params.q.trim().is_empty() {
        "Search - engmanager.xyz".to_string()
    } else {
        format!("Search: {} - engmanager.xyz", params.q.trim())
    };
    let article_results = render_article_results(&results.article_hits);
    let comment_results = render_comment_results(&results.comment_hits);
    // Only render the Caps group when there are product matches, so article
    // searches aren't cluttered with an empty store section.
    let product_section = if results.product_hits.is_empty() {
        HtmlFragment::empty()
    } else {
        let product_results = render_product_results(&results.product_hits);
        view! {
            <section class="search-result-group search-result-group-caps">
                <h2>"Caps"</h2>
                { product_results }
            </section>
        }
    };
    let filters = render_filters(params, search_query, results);
    let empty = if results.total_articles == 0
        && results.total_comments == 0
        && results.total_products == 0
    {
        view! {
            <section class="search-empty">
                <h2>"No matches"</h2>
                <p>"Try a broader phrase or remove a filter."</p>
            </section>
        }
    } else {
        HtmlFragment::empty()
    };
    let cap_summary = if results.total_products > 0 {
        format!(
            " · {} cap{}",
            results.total_products,
            plural(results.total_products)
        )
    } else {
        String::new()
    };
    let summary = format!(
        "{} article{} · {} comment{}{}",
        results.total_articles,
        plural(results.total_articles),
        results.total_comments,
        plural(results.total_comments),
        cap_summary
    );

    // The search page shows the plain-link nav config (no recent-articles
    // dropdown), so it pulls in no co-located CSS and no dropdown JS.
    let nav = nav::render(nav::Props {
        brand_icon_url: asset_url("favicon.svg"),
        global_search: render_global_search("Search"),
        search_toggle: render_nav_search_toggle(),
        articles: nav::Articles::Link,
    });
    let nav_head = nav.head();
    let nav_markup = nav.markup;

    Html(html! {
        <!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>{ title }</title>
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
                { render_sitemap_link() }
                { render_resource_hints() }
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
                <link rel="stylesheet" href={ asset_url("css/search.css") } />
                <script src={ asset_url("js/theme-toggle.js") }></script>
                { render_sfx_urls() }
                <script src={ asset_url("js/audio.js") } defer></script>
                <script src={ asset_url("js/search.js") } defer></script>
                <script src={ asset_url("js/search-keyclick.js") } defer></script>
                { nav_head }
                <script src={ asset_url("js/view-transitions.js") } defer></script>
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content="#e64553" />
                { render_dev_meta() }
            </head>
            <body class="search-page">
                <a class="skip-link" href="#main">"Skip to content"</a>
                { nav_markup }
                <main id="main" class="search-shell" tabindex="-1">
                    <header class="search-header">
                        <h1>"Search"</h1>
                        <p>{ summary }</p>
                    </header>
                    <form class="search-workbench" action="/search" method="get">
                        <section class="search-query-panel">
                            <label class="sr-only" for="search-page-input">"Search"</label>
                            <input id="search-page-input"
                                   class="search-page-input"
                                   type="search"
                                   name="q"
                                   value={ params.q.clone() }
                                   placeholder="Search articles and comments"
                                   autocomplete="off" />
                            <div class="search-date-row">
                                <label>
                                    <span>"From"</span>
                                    <input type="date" name="from" value={ params.from.clone().unwrap_or_default() } />
                                </label>
                                <label>
                                    <span>"To"</span>
                                    <input type="date" name="to" value={ params.to.clone().unwrap_or_default() } />
                                </label>
                                <button type="submit">"Apply"</button>
                            </div>
                        </section>
                        { filters }
                    </form>
                    <div class="search-results-grid">
                        { product_section }
                        <section class="search-result-group">
                            <h2>"Articles"</h2>
                            { article_results }
                        </section>
                        <section class="search-result-group">
                            <h2>"Comments"</h2>
                            { comment_results }
                        </section>
                    </div>
                    { empty }
                </main>
            </body>
        </html>
    }.into_string())
}

fn render_filters(
    params: &SearchParams,
    query: &SearchQuery,
    results: &SearchResults,
) -> HtmlFragment {
    let category_controls: HtmlFragment = Category::ALL
        .iter()
        .map(|category| {
            let count = results
                .facets
                .categories
                .iter()
                .find(|(candidate, _)| candidate == category)
                .map(|(_, count)| *count)
                .unwrap_or(0);
            render_category_control(*category, count, query.categories.contains(category))
        })
        .collect();
    let tag_controls: HtmlFragment = all_indexed_article_tags()
        .iter()
        .map(|tag| {
            let count = results
                .facets
                .tags
                .iter()
                .find(|(candidate, _)| candidate == tag)
                .map(|(_, count)| *count)
                .unwrap_or(0);
            render_tag_control(*tag, count, query.tags.contains(tag))
        })
        .collect();
    let clear_href = if params.q.trim().is_empty() {
        "/search".to_string()
    } else {
        format!("/search?q={}", query_encode(params.q.trim()))
    };

    view! {
        <aside class="search-filters" aria-label="Search filters">
            <div class="search-filter-head">
                <h2>"Filters"</h2>
                <a href={ clear_href }>"Clear"</a>
            </div>
            <fieldset>
                <legend>"Category"</legend>
                { category_controls }
            </fieldset>
            <fieldset>
                <legend>"Tags"</legend>
                { tag_controls }
            </fieldset>
        </aside>
    }
}

fn render_category_control(category: Category, count: usize, selected: bool) -> HtmlFragment {
    let label = format!("{} {}", category.emoji(), category.label());
    let count_label = count.to_string();
    if selected {
        view! {
            <label class="search-filter-option is-selected">
                <input type="checkbox" name="category" value={ category.slug() } checked />
                <span>{ label }</span>
                <span>{ count_label }</span>
            </label>
        }
    } else {
        view! {
            <label class="search-filter-option">
                <input type="checkbox" name="category" value={ category.slug() } />
                <span>{ label }</span>
                <span>{ count_label }</span>
            </label>
        }
    }
}

fn render_tag_control(tag: Tag, count: usize, selected: bool) -> HtmlFragment {
    let label = format!("{} {}", tag.emoji(), tag.label());
    let count_label = count.to_string();
    if selected {
        view! {
            <label class="search-filter-option is-selected">
                <input type="checkbox" name="tag" value={ tag.slug() } checked />
                <span>{ label }</span>
                <span>{ count_label }</span>
            </label>
        }
    } else {
        view! {
            <label class="search-filter-option">
                <input type="checkbox" name="tag" value={ tag.slug() } />
                <span>{ label }</span>
                <span>{ count_label }</span>
            </label>
        }
    }
}

fn render_article_results(hits: &[ArticleSearchHit]) -> HtmlFragment {
    if hits.is_empty() {
        return view! { <p class="search-muted">"No article matches."</p> };
    }
    hits.iter()
        .map(|hit| {
            let href = format!("/articles/{}", hit.slug);
            let date = hit.date.label();
            let tag_chips: HtmlFragment = hit
                .tags
                .iter()
                .map(|tag| view! { <span class="search-chip">{ tag.label() }</span> })
                .collect();
            view! {
                <article class="search-result">
                    <a class="search-result-title" href={ href }>{ hit.title.clone() }</a>
                    <div class="search-result-meta">
                        <span>{ hit.category.label() }</span>
                        <time datetime={ hit.date.iso() }>{ date }</time>
                    </div>
                    <p>{ hit.snippet.clone() }</p>
                    <div class="search-chip-row">{ tag_chips }</div>
                </article>
            }
        })
        .collect()
}

fn render_comment_results(hits: &[CommentSearchHit]) -> HtmlFragment {
    if hits.is_empty() {
        return view! { <p class="search-muted">"No comment matches."</p> };
    }
    hits.iter()
        .map(|hit| {
            let href = format!("/articles/{}#comment-{}", hit.article_slug, hit.comment_id);
            let byline = format!("{} on {}", hit.author_name, hit.article_title);
            view! {
                <article class="search-result search-result-comment">
                    <a class="search-result-title" href={ href }>{ byline }</a>
                    <blockquote>{ hit.quote_exact.clone() }</blockquote>
                    <p>{ hit.snippet.clone() }</p>
                </article>
            }
        })
        .collect()
}

fn render_product_results(hits: &[ProductSearchHit]) -> HtmlFragment {
    if hits.is_empty() {
        return HtmlFragment::empty();
    }
    hits.iter()
        .map(|hit| {
            let price = format!("${}", hit.price);
            let chip_style = format!(
                "--cap: {}; --thread: {}; --accent: {}",
                hit.cap_color, hit.thread_color, hit.accent_color
            );
            view! {
                <article class="search-result search-result-product">
                    <a class="search-result-title" href={ hit.url.clone() }>
                        <span class="search-cap-chip" style={ chip_style } aria-hidden="true">
                            <span class="search-cap-crown"></span>
                            <span class="search-cap-brim"></span>
                            <span class="search-cap-dot"></span>
                        </span>
                        { hit.name.clone() }
                    </a>
                    <div class="search-result-meta">
                        <span>"Dad cap"</span>
                        <span>{ price }</span>
                    </div>
                    <p>{ hit.description.clone() }</p>
                </article>
            }
        })
        .collect()
}

fn no_store<T: IntoResponse>(response: T) -> impl IntoResponse {
    ([(header::CACHE_CONTROL, "no-store")], response)
}

fn plural(count: usize) -> &'static str {
    if count == 1 { "" } else { "s" }
}

fn query_decode(value: &str) -> String {
    let mut bytes = Vec::with_capacity(value.len());
    let mut input = value.as_bytes().iter().copied();
    while let Some(byte) = input.next() {
        match byte {
            b'+' => bytes.push(b' '),
            b'%' => {
                let Some(high) = input.next() else {
                    bytes.push(byte);
                    break;
                };
                let Some(low) = input.next() else {
                    bytes.push(byte);
                    bytes.push(high);
                    break;
                };
                match (hex_value(high), hex_value(low)) {
                    (Some(high), Some(low)) => bytes.push((high << 4) | low),
                    _ => {
                        bytes.push(byte);
                        bytes.push(high);
                        bytes.push(low);
                    }
                }
            }
            _ => bytes.push(byte),
        }
    }
    String::from_utf8_lossy(&bytes).into_owned()
}

fn query_encode(value: &str) -> String {
    let mut encoded = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'.' | b'_' | b'~' => {
                encoded.push(byte as char);
            }
            b' ' => encoded.push('+'),
            _ => {
                use std::fmt::Write;
                let _ = write!(encoded, "%{byte:02X}");
            }
        }
    }
    encoded
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}
