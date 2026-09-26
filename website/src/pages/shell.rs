//! PageShell — the invariant document scaffold shared by every HTML page.
//!
//! Owns exactly what never varies (or varies only by a typed prop): doctype,
//! `<html lang>`, charset/viewport, `<title>`, favicon, sitemap link, resource
//! hints, the open-props → critical.css stylesheets, the
//! synchronous theme runtime (theme-toggle.js + the `__engSfxUrls` island),
//! manifest link, theme-color, dev-mode marker, and the body scaffold
//! (skip-link + `<body class>`). Everything page/component-specific flows
//! through two [`Head`] collectors:
//!
//! - [`PageShell::assets`]: the stylesheet section emitted right after
//!   critical.css (page CSS, component CSS, per-page asset blocks).
//! - [`PageShell::scripts`]: the script section emitted right after the theme
//!   runtime (deferred scripts, data islands, component heads).
//!
//! CRITICAL sequencing invariants (refactor-plan hard invariants): per-page
//! head order stays open-props → critical.css → page assets → typography →
//! theme-toggle.js (synchronous, never deferred) → `__engSfxUrls` island
//! (before any `audio.js` consumer) → page scripts; both collectors preserve
//! insertion order so shared assets initialize consistently on every page.
//! (Patterns: rust-core-patterns "builders"; maud-components-patterns layout
//! composition, ported to eng-markup.)

use std::fmt::Write;

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::{
    OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls, render_sitemap_link,
};
use crate::asset_url;
use crate::components::Head;

/// Default accent `theme-color` shared by every page except the 404 stage.
const DEFAULT_THEME_COLOR: &str = "#e64553";

/// Prerender same-origin links eagerly, but never checkout (order context),
/// API endpoints, or search result pages (unbounded query space).
const SPECULATION_RULES_JSON: &str = r#"{"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/checkout*"}},{"not":{"href_matches":"/api/*"}},{"not":{"href_matches":"/search*"}},{"not":{"href_matches":"/personality*"}},{"not":{"href_matches":"/articles/big-personality*"}}]},"eagerness":"moderate"}]}"#;

/// Inline `window.__engNav` bootstrap: the mount/dispose callback registries
/// that bundles register against (`onSwap` / `onBeforeSwap`) and the router
/// fires (`_fire` / `_before`) around each soft swap. Emitted on EVERY shell
/// page, ahead of all deferred scripts, so a bundle can register
/// unconditionally whether or not the page ships the router. Set-based with
/// per-callback try/catch — one broken callback never blocks the rest.
/// Kept under 300 bytes.
const ENG_NAV_BOOTSTRAP: &str = r#"<script>window.__engNav=(()=>{const s=new Set(),b=new Set(),a=(s,c)=>(s.add(c),()=>s.delete(c)),f=(s,m)=>{for(const c of s){try{c(m)}catch{}}};return{onSwap:c=>a(s,c),_fire:m=>f(s,m),onBeforeSwap:c=>a(b,c),_before:m=>f(b,m)}})();</script>"#;

/// Escape a string for embedding inside a JSON string literal that itself
/// lives in a `<script>` element: the JSON specials (`"`, `\`, control chars)
/// plus `<`/`>`/`&` as `\uXXXX` so the payload can never form `</script>` or
/// other markup inside the island.
pub fn json_str_escape(value: &str) -> String {
    use std::fmt::Write;

    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            '<' => out.push_str("\\u003c"),
            '>' => out.push_str("\\u003e"),
            '&' => out.push_str("\\u0026"),
            c if (c as u32) < 0x20 => {
                let _ = write!(out, "\\u{:04x}", c as u32);
            }
            c => out.push(c),
        }
    }
    out
}

/// `<script type="application/ld+json">` island. `payload` is a complete,
/// already-serialized JSON-LD object (string fields routed through
/// [`json_str_escape`] by the builder, so no `<` survives into the bytes).
pub fn json_ld_island(payload: &str) -> HtmlFragment {
    HtmlFragment::new(format!(
        r#"<script type="application/ld+json">{}</script>"#,
        crate::components::escape_script_payload(payload)
    ))
}

/// SEO head block rendered immediately after `<title>`, in a fixed tag order:
/// description → canonical → robots → og:* → article:published_time →
/// twitter:card → JSON-LD islands. Every field is optional so a page emits
/// only what it sets (e.g. a hidden article sets `robots` alone and renders
/// byte-identically to its pre-shell head).
#[derive(Default)]
pub struct MetaTags {
    pub description: Option<String>,
    pub canonical: Option<String>,
    pub robots: Option<&'static str>,
    pub og_title: Option<String>,
    pub og_type: Option<&'static str>,
    /// Absolute URL of the 1200x630 share card. Scrapers do NOT resolve
    /// relative URLs, so this must include the origin.
    pub og_image: Option<String>,
    /// Alt text for the card, and the explicit pixel box. LinkedIn in
    /// particular renders a small card (or nothing on a first scrape) when
    /// the dimensions are absent, because it will not block on downloading
    /// the image to find out how big it is.
    pub og_image_alt: Option<String>,
    pub og_image_size: Option<(u16, u16)>,
    pub og_url: Option<String>,
    /// LinkedIn and Slack read `og:description`; only Google reads the plain
    /// `<meta name=description>`. Defaults to `description` when unset.
    pub og_description: Option<String>,
    pub og_site_name: Option<&'static str>,
    /// `article:published_time` (ISO date) — article detail pages only.
    pub published_time: Option<String>,
    pub twitter_card: Option<&'static str>,
    pub json_ld: Vec<HtmlFragment>,
}

impl MetaTags {
    fn render(self) -> HtmlFragment {
        let mut out = HtmlFragment::empty();
        // Social scrapers fall back to the page description when the page
        // does not spell out an og:description, so mirror it by default.
        let og_description = self
            .og_description
            .clone()
            .or_else(|| self.description.clone());
        if let Some(description) = self.description {
            out.push_fragment(view! { <meta name="description" content={ description } /> });
        }
        if let Some(canonical) = self.canonical {
            out.push_fragment(view! { <link rel="canonical" href={ canonical } /> });
        }
        if let Some(robots) = self.robots {
            out.push_fragment(view! { <meta name="robots" content={ robots } /> });
        }
        if let Some(og_title) = self.og_title {
            out.push_fragment(view! { <meta property="og:title" content={ og_title } /> });
        }
        if let Some(og_type) = self.og_type {
            out.push_fragment(view! { <meta property="og:type" content={ og_type } /> });
        }
        if let Some(og_image) = self.og_image {
            out.push_fragment(view! { <meta property="og:image" content={ og_image.clone() } /> });
            // Twitter falls back to og:image, but Slack and a few others only
            // look at twitter:image when a twitter:card is present.
            out.push_fragment(view! { <meta name="twitter:image" content={ og_image } /> });
            if let Some((width, height)) = self.og_image_size {
                out.push_fragment(view! { <meta property="og:image:width" content={ width } /> });
                out.push_fragment(view! { <meta property="og:image:height" content={ height } /> });
            }
            if let Some(alt) = self.og_image_alt {
                out.push_fragment(
                    view! { <meta property="og:image:alt" content={ alt.clone() } /> },
                );
                out.push_fragment(view! { <meta name="twitter:image:alt" content={ alt } /> });
            }
        }
        if let Some(site_name) = self.og_site_name {
            out.push_fragment(view! { <meta property="og:site_name" content={ site_name } /> });
        }
        if let Some(description) = og_description {
            out.push_fragment(
                view! { <meta property="og:description" content={ description.clone() } /> },
            );
            out.push_fragment(
                view! { <meta name="twitter:description" content={ description } /> },
            );
        }
        if let Some(og_url) = self.og_url {
            out.push_fragment(view! { <meta property="og:url" content={ og_url } /> });
        }
        if let Some(published) = self.published_time {
            out.push_fragment(
                view! { <meta property="article:published_time" content={ published } /> },
            );
        }
        if let Some(card) = self.twitter_card {
            out.push_fragment(view! { <meta name="twitter:card" content={ card } /> });
        }
        for island in self.json_ld {
            out.push_fragment(island);
        }
        out
    }
}

/// Builder for the invariant document scaffold. Construct with
/// [`PageShell::new`], set the per-page props, then [`PageShell::render`] the
/// page body into a complete document.
pub struct PageShell {
    title: String,
    /// Raw fragment emitted BEFORE `<title>` (the 404 page's robots meta).
    pre_title_meta: HtmlFragment,
    meta: Option<MetaTags>,
    /// Raw fragment emitted after the [`MetaTags`] block (verbatim per-page
    /// meta predating MetaTags — the shop og/twitter set, the article reveal
    /// bootstrap script).
    raw_meta: HtmlFragment,
    assets: Head,
    scripts: Head,
    theme_color: &'static str,
    speculation_rules: bool,
    nav_router: bool,
    journey: Option<(&'static str, Option<&'static str>)>,
    body_class: &'static str,
    /// Extra attribute on `<body>` (checkout's `data-checkout-mode`).
    body_attr: Option<(&'static str, &'static str)>,
    /// Skip-link label; `None` renders no skip-link (the 404 stage).
    skip_link: Option<&'static str>,
}

impl PageShell {
    pub fn new(title: impl Into<String>, body_class: &'static str) -> Self {
        Self {
            title: title.into(),
            pre_title_meta: HtmlFragment::empty(),
            meta: None,
            raw_meta: HtmlFragment::empty(),
            assets: Head::new(),
            scripts: Head::new(),
            theme_color: DEFAULT_THEME_COLOR,
            speculation_rules: false,
            nav_router: false,
            journey: None,
            body_class,
            body_attr: None,
            skip_link: Some("Skip to content"),
        }
    }

    pub fn pre_title_meta(mut self, fragment: HtmlFragment) -> Self {
        self.pre_title_meta = fragment;
        self
    }

    pub fn meta(mut self, meta: MetaTags) -> Self {
        self.meta = Some(meta);
        self
    }

    pub fn raw_meta(mut self, fragment: HtmlFragment) -> Self {
        self.raw_meta = fragment;
        self
    }

    /// Stylesheet-section collector, emitted right after critical.css.
    pub fn assets(mut self, assets: Head) -> Self {
        self.assets = assets;
        self
    }

    /// Script-section collector, emitted right after theme-toggle.js + the
    /// `__engSfxUrls` island.
    pub fn scripts(mut self, scripts: Head) -> Self {
        self.scripts = scripts;
        self
    }

    pub fn theme_color(mut self, color: &'static str) -> Self {
        self.theme_color = color;
        self
    }

    /// Permit the speculation-rules prerender island on indexable pages.
    /// Router-enabled pages suppress it in favor of one inert staged fetch.
    pub fn speculation_rules(mut self, enabled: bool) -> Self {
        self.speculation_rules = enabled;
        self
    }

    /// Ship the shared soft-navigation router, `js/nav-router.js`, on eligible
    /// blog, store and coaching pages. The tag
    /// is appended after every page script through the shared [`Head`]
    /// collector, so it participates in normal first-seen dedup. The router
    /// progressively enhances ordinary links in supporting browsers.
    pub fn nav_router(mut self, enabled: bool) -> Self {
        self.nav_router = enabled;
        self
    }

    /// One complete page outlet, including its navigation and dialog markup.
    /// The next destination is an ordinary same-origin URL and remains a real
    /// link when scripting, intersection observers, or motion are unavailable.
    pub fn journey(mut self, kind: &'static str, next: Option<&'static str>) -> Self {
        self.nav_router = true;
        self.journey = Some((kind, next));
        self
    }

    pub fn body_attr(mut self, name: &'static str, value: &'static str) -> Self {
        self.body_attr = Some((name, value));
        self
    }

    pub fn skip_link(mut self, label: Option<&'static str>) -> Self {
        self.skip_link = label;
        self
    }

    pub fn render(self, body: HtmlFragment) -> String {
        // One combined collector: the overlay-cluster component sheets split
        // out of critical.css (ledger #8 — every page carried these rules via
        // critical.css, so every page keeps them, pinned immediately after the
        // critical.css link), then page assets, then the synchronous theme
        // runtime (theme-toggle.js MUST stay render-blocking so the theme
        // class lands before first paint; the sfx island MUST precede every
        // audio.js consumer), then page scripts. Merging through `extend`
        // keeps first-seen dedup global across all sections, so a page that
        // also declares a component's sheet emits it exactly once, here.
        let mut head = Head::new();
        head.add_deferred_css(crate::components::api_receipt::STYLE);
        head.add_css(crate::components::quick_actions::STYLE);
        if self.nav_router {
            head.add_css("css/journey.css");
        }
        head.extend(self.assets);
        head.add_inline(super::typography::config());
        head.add_blocking_js("js/theme-fonts.js");
        head.add_blocking_js("js/theme-toggle.js");
        head.add_inline(render_sfx_urls());
        head.extend(self.scripts);
        // Router-eligible pages append the soft-navigation router after every
        // page script (deferred; execution order is irrelevant — it only
        // registers a `navigate` listener). The `__engNav` bootstrap it fires
        // is emitted further up, before any script tier.
        if self.nav_router {
            head.add_js("js/nav-router.js");
        }

        let mut doc = String::with_capacity(16 * 1024);
        doc.push_str("<!DOCTYPE html><html lang=\"en\"><head>");
        doc.push_str(
            view! {
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
            }
            .as_str(),
        );
        doc.push_str(self.pre_title_meta.as_str());
        doc.push_str(view! { <title>{ self.title }</title> }.as_str());
        if let Some(meta) = self.meta {
            doc.push_str(meta.render().as_str());
        }
        doc.push_str(self.raw_meta.as_str());
        doc.push_str(
            view! {
                <link rel="icon" type="image/svg+xml" href={ asset_url("favicon.svg") } />
            }
            .as_str(),
        );
        doc.push_str(render_sitemap_link().as_str());
        doc.push_str(render_resource_hints().as_str());
        doc.push_str(
            view! {
                <link rel="stylesheet" href=OPEN_PROPS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
            }
            .as_str(),
        );
        // ledger #15: the tiny `window.__engNav` registry rides every shell
        // page, pinned before all script tiers so each deferred bundle can
        // call `onSwap` at module scope.
        doc.push_str(ENG_NAV_BOOTSTRAP);
        doc.push_str(head.render().as_str());
        doc.push_str(
            view! {
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content={ self.theme_color } />
            }
            .as_str(),
        );
        // The journey router owns its single inert next-page fetch. Native
        // prerenders would execute page scripts before that page is promoted.
        if self.speculation_rules && !self.nav_router {
            // ledger #14: `data-server` marks the island as server-owned so
            // experiences.js never injects a duplicate rules script after a
            // soft navigation (its onSoftNav guard queries this attribute).
            doc.push_str(r#"<script type="speculationrules" data-server>"#);
            doc.push_str(SPECULATION_RULES_JSON);
            doc.push_str("</script>");
        }
        doc.push_str(render_dev_meta().as_str());
        doc.push_str("</head>");
        // The open `<body>` tag is assembled manually: `view!` can only emit
        // balanced trees, and the extra attribute is optional. Both values are
        // crate-controlled `&'static str`s (no escaping needed).
        match self.body_attr {
            Some((name, value)) => {
                let _ = write!(
                    doc,
                    "<body class=\"{}\" {name}=\"{value}\">",
                    self.body_class
                );
            }
            None => {
                let _ = write!(doc, "<body class=\"{}\">", self.body_class);
            }
        }
        if let Some(label) = self.skip_link {
            doc.push_str(view! { <a class="skip-link" href="#main">{ label }</a> }.as_str());
        }
        if let Some((kind, next)) = self.journey {
            let _ = write!(doc, "<div data-eng-page=\"{kind}\"");
            if let Some(next) = next {
                let _ = write!(doc, " data-eng-next=\"{next}\"");
            }
            doc.push('>');
            doc.push_str(body.as_str());
            if let Some(next) = next {
                let label = match kind {
                    "article" => "Explore the store",
                    "shop" => "Discover coaching",
                    "coach" => "Back to the feed",
                    _ => "Continue exploring",
                };
                doc.push_str(view! {
                    <footer class="journey-next" data-journey-fallback>
                        <a class="journey-next-link" href={ next }>{ label }<span aria-hidden="true">" ↗"</span></a>
                    </footer>
                }.as_str());
            }
            doc.push_str("</div>");
        } else {
            doc.push_str(body.as_str());
        }
        doc.push_str("</body></html>");
        doc
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::components::Rendered;

    fn component(css: &'static str, js: &'static str) -> Rendered {
        Rendered {
            markup: HtmlFragment::empty(),
            critical_css: vec![css],
            deferred_css: Vec::new(),
            js_deps: vec![js],
        }
    }

    #[test]
    fn shell_orders_invariants_and_dedups_component_deps() {
        let mut assets = Head::new();
        assets.add_css("css/search.css");
        let mut scripts = Head::new();
        scripts.add_js("js/audio.js");
        // Two components sharing js/popover-registry.js → one tag.
        scripts.add(&component("css/c-nav.css", "js/popover-registry.js"));
        scripts.add(&component("css/c-to-top.css", "js/popover-registry.js"));

        let html = PageShell::new("Shell Test", "search-page")
            .assets(assets)
            .scripts(scripts)
            .render(HtmlFragment::new("<main id=\"main\"></main>".to_string()));

        // critical.css precedes the page stylesheet.
        let critical = html.find("/assets/css/critical.").expect("critical.css");
        let page_css = html.find("/assets/css/search.").expect("page css");
        assert!(critical < page_css, "critical.css must precede page css");
        // Manifest present on every page.
        assert!(html.contains("rel=\"manifest\""));
        // theme-toggle.js stays synchronous (no defer) and precedes audio.js.
        let theme = html.find("theme-toggle").expect("theme-toggle");
        assert!(!html[theme..].starts_with("theme-toggle.js\" defer"));
        let audio = html.find("/assets/js/audio.").expect("audio.js");
        assert!(theme < audio);
        // The sfx island sits between them (before every audio.js consumer).
        let sfx = html.find("window.__engSfxUrls=").expect("sfx island");
        assert!(theme < sfx && sfx < audio);
        // Shared dep deduped to a single tag.
        assert_eq!(html.matches("popover-registry").count(), 1);
        // Body scaffold: skip-link by default, no speculation rules.
        assert!(html.contains(r##"<body class="search-page"><a class="skip-link" href="#main">"##));
        assert!(!html.contains("speculationrules"));
        // ledger #15: the __engNav bootstrap rides every page, ahead of all
        // script tiers (theme-toggle included), and stays under 300 bytes.
        let bootstrap = html.find("window.__engNav=").expect("engNav bootstrap");
        assert!(bootstrap < theme, "bootstrap must precede every script");
        assert!(ENG_NAV_BOOTSTRAP.len() < 300, "bootstrap budget is 300B");
        // ledger #16: the router script is opt-in; default pages skip it.
        assert!(!html.contains("nav-router"));
    }

    #[test]
    fn shell_nav_router_prop_appends_one_deferred_tag() {
        let mut scripts = Head::new();
        scripts.add_js("js/audio.js");
        let html = PageShell::new("Router Page", "homepage")
            .scripts(scripts)
            .speculation_rules(true)
            .nav_router(true)
            .render(HtmlFragment::empty());

        // Exactly one deferred tag, after the page scripts, after the
        // bootstrap inline.
        assert_eq!(html.matches("/assets/js/nav-router.").count(), 1);
        let tag = html.find("/assets/js/nav-router.").expect("router tag");
        let tag_open = html[..tag].rfind("<script").expect("script tag");
        let tag_close = tag_open + html[tag_open..].find('>').expect("tag close");
        assert!(html[tag_open..tag_close].contains("defer"));
        let bootstrap = html.find("window.__engNav=").expect("engNav bootstrap");
        let audio = html.find("/assets/js/audio.").expect("audio.js");
        assert!(bootstrap < audio && audio < tag);
        assert!(!html.contains("speculationrules"));
    }

    #[test]
    fn shell_per_page_props_render() {
        let html = PageShell::new("Checkout", "checkout-page")
            .body_attr("data-checkout-mode", "checkout")
            .theme_color("#11111b")
            .speculation_rules(true)
            .skip_link(None)
            .render(HtmlFragment::empty());

        assert!(html.contains(r#"<body class="checkout-page" data-checkout-mode="checkout">"#));
        assert!(html.contains(r##"<meta name="theme-color" content="#11111b">"##));
        assert!(html.contains(&format!(
            r#"<script type="speculationrules" data-server>{SPECULATION_RULES_JSON}</script>"#
        )));
        assert!(!html.contains("skip-link"));
    }

    #[test]
    fn meta_tags_render_in_fixed_order() {
        let meta = MetaTags {
            description: Some("A description.".to_string()),
            canonical: Some("https://engmanager.xyz/".to_string()),
            robots: Some("noindex,nofollow"),
            og_title: Some("Title".to_string()),
            og_type: Some("website"),
            og_image: Some("https://example.com/a.png".to_string()),
            og_image_alt: Some("Alt text.".to_string()),
            og_image_size: Some((1200, 630)),
            og_url: Some("https://engmanager.xyz/".to_string()),
            og_description: None,
            og_site_name: Some("ENGMANAGER.XYZ"),
            published_time: Some("2026-05-30".to_string()),
            twitter_card: Some("summary_large_image"),
            json_ld: vec![json_ld_island(r#"{"@type":"WebSite"}"#)],
        };
        let html = meta.render().into_string();
        let order = [
            r#"<meta name="description""#,
            r#"<link rel="canonical""#,
            r#"<meta name="robots""#,
            r#"<meta property="og:title""#,
            r#"<meta property="og:type""#,
            r#"<meta property="og:image" content="https://example.com/a.png">"#,
            r#"<meta name="twitter:image""#,
            r#"<meta property="og:image:width" content="1200">"#,
            r#"<meta property="og:image:height" content="630">"#,
            r#"<meta property="og:image:alt""#,
            r#"<meta name="twitter:image:alt""#,
            r#"<meta property="og:site_name""#,
            // og:description mirrors the page description when unset — the
            // scrapers that matter read og:description, not name=description.
            r#"<meta property="og:description" content="A description.">"#,
            r#"<meta name="twitter:description""#,
            r#"<meta property="og:url""#,
            r#"<meta property="article:published_time""#,
            r#"<meta name="twitter:card" content="summary_large_image">"#,
            r#"<script type="application/ld+json">"#,
        ];
        let mut last = 0;
        for needle in order {
            let at = html
                .find(needle)
                .unwrap_or_else(|| panic!("missing {needle}"));
            assert!(at >= last, "{needle} out of order");
            last = at;
        }
    }

    #[test]
    fn json_str_escape_neutralizes_markup_and_json_specials() {
        assert_eq!(
            json_str_escape("a \"b\" \\ </script> & \n"),
            "a \\\"b\\\" \\\\ \\u003c/script\\u003e \\u0026 \\n"
        );
    }
}
