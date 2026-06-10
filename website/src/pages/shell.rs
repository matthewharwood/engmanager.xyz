//! PageShell — the invariant document scaffold shared by every HTML page.
//!
//! Owns exactly what never varies (or varies only by a typed prop): doctype,
//! `<html lang>`, charset/viewport, `<title>`, favicon, sitemap link, resource
//! hints, the open-props → Google-fonts → critical.css stylesheet trio, the
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
//! head order stays EXACTLY open-props → fonts → critical.css → page assets →
//! theme-toggle.js (synchronous, never deferred) → `__engSfxUrls` island
//! (before any `audio.js` consumer) → page scripts; both collectors preserve
//! insertion order so each page reproduces its pre-shell head byte-for-byte.
//! (Patterns: rust-core-patterns "builders"; maud-components-patterns layout
//! composition, ported to eng-markup.)

use std::fmt::Write;

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::{
    GOOGLE_FONTS_HREF, OPEN_PROPS_HREF, render_dev_meta, render_resource_hints, render_sfx_urls,
    render_sitemap_link,
};
use crate::asset_url;
use crate::components::Head;

/// Default accent `theme-color` shared by every page except the 404 stage.
const DEFAULT_THEME_COLOR: &str = "#e64553";

/// Prerender same-origin links eagerly, but never checkout (order context),
/// API endpoints, or search result pages (unbounded query space).
const SPECULATION_RULES_JSON: &str = r#"{"prerender":[{"where":{"and":[{"href_matches":"/*"},{"not":{"href_matches":"/checkout*"}},{"not":{"href_matches":"/api/*"}},{"not":{"href_matches":"/search*"}}]},"eagerness":"moderate"}]}"#;

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
    pub og_image: Option<&'static str>,
    pub og_url: Option<String>,
    /// `article:published_time` (ISO date) — article detail pages only.
    pub published_time: Option<String>,
    pub twitter_card: Option<&'static str>,
    pub json_ld: Vec<HtmlFragment>,
}

impl MetaTags {
    fn render(self) -> HtmlFragment {
        let mut out = HtmlFragment::empty();
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
            out.push_fragment(view! { <meta property="og:image" content={ og_image } /> });
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

    /// Emit the speculation-rules prerender island (site-host indexable pages
    /// only: homepage, articles index, indexed article detail, search).
    pub fn speculation_rules(mut self, enabled: bool) -> Self {
        self.speculation_rules = enabled;
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
        head.extend(self.assets);
        head.add_blocking_js("js/theme-toggle.js");
        head.add_inline(render_sfx_urls());
        head.extend(self.scripts);

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
                <link rel="stylesheet" href=GOOGLE_FONTS_HREF />
                <link rel="stylesheet" href={ asset_url("css/critical.css") } />
            }
            .as_str(),
        );
        doc.push_str(head.render().as_str());
        doc.push_str(
            view! {
                <link rel="manifest" href={ asset_url("manifest.webmanifest") } />
                <meta name="theme-color" content={ self.theme_color } />
            }
            .as_str(),
        );
        if self.speculation_rules {
            doc.push_str(r#"<script type="speculationrules">"#);
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
        doc.push_str(body.as_str());
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
            r#"<script type="speculationrules">{SPECULATION_RULES_JSON}</script>"#
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
            og_image: Some("https://example.com/a.png"),
            og_url: Some("https://engmanager.xyz/".to_string()),
            published_time: Some("2026-05-30".to_string()),
            twitter_card: Some("summary"),
            json_ld: vec![json_ld_island(r#"{"@type":"WebSite"}"#)],
        };
        let html = meta.render().into_string();
        let order = [
            r#"<meta name="description""#,
            r#"<link rel="canonical""#,
            r#"<meta name="robots""#,
            r#"<meta property="og:title""#,
            r#"<meta property="og:type""#,
            r#"<meta property="og:image""#,
            r#"<meta property="og:url""#,
            r#"<meta property="article:published_time""#,
            r#"<meta name="twitter:card""#,
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
