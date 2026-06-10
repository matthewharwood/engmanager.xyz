//! Project FootTraffic regional-operator map — co-located component.
//!
//! The interactive Leaflet map spliced into the project-foottraffic article
//! (the `<!--foottraffic-map-->` sentinel): copy block, canvas + poster
//! fallback shell, figcaption, the JSON config island the script reads, and
//! a `<noscript>` text fallback. Pure render — the poster image URL is
//! hoisted by the caller via [`Props`] (`asset_url` is page-level).
//!
//! JS contract: the co-located `script.js` (served as `js/c-region-map.js`,
//! formerly the flat `js/region-map.js`) mounts Leaflet into
//! `[data-region-map-canvas]`, reading `[data-region-map-config]` and
//! swapping out the `[data-region-map-poster]` once tiles settle.
//!
//! ORDERING CONSTRAINT (page-level, cannot be expressed via `js_deps`): the
//! Leaflet CDN `<script>` MUST precede `js/c-region-map.js` in the head.
//! `js_deps` carry `asset_url` dist paths only, so the CDN tag stays a
//! page-level inline fragment that the mounting page emits immediately
//! before this component's SCRIPT — see the project-foottraffic head block
//! in `pages/articles.rs`.
//!
//! Styles: the co-located `style.css` is the ENTIRE former
//! `css/src/region-map.css`, verbatim and un-layered like its source
//! (ledger #8). Tier: `critical_css` — the figure (poster + status) is
//! visible in-flow content at first paint, so the sheet stays a
//! render-blocking link at the flat file's old head position.

use eng_domain::HtmlFragment;
use eng_markup::view;

use super::{Rendered, escape_script_payload};

/// Dist assets emitted by `build.rs` from this folder's `style.css` /
/// `script.js` — generated consts, so a renamed folder fails compilation
/// instead of 404ing.
pub use super::asset_names::region_map::{SCRIPT, STYLE};

/// Props for the map figure. The hashed poster-image URL is hoisted by the
/// caller (render stays pure — no `asset_url` inside).
pub struct Props {
    pub poster_url: String,
}

/// Pure render: `Props -> Rendered`. Markup byte-identical to the pre-P4
/// `render_foottraffic_map` in `pages/articles.rs`.
pub fn render(props: Props) -> Rendered {
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

    let markup = view! {
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
                    <img src={ props.poster_url }
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
            // Config island routed through the shared script-island escaper
            // (no `</script>` / U+2028/9 breakout possible). Byte-neutral for
            // this literal — it contains none of the escaped code points —
            // and pinned by the test below.
            <script type="application/json" data-region-map-config>
                { HtmlFragment::new(escape_script_payload(config)) }
            </script>
            <noscript>
                <p>
                    "Map locations: Matthew in Portland, Marcus in Los Angeles, Jason in Austin, and Alex in Detroit."
                </p>
            </noscript>
        </figure>
    };

    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: Vec::new(),
        js_deps: vec![SCRIPT],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rendered() -> Rendered {
        render(Props {
            poster_url: "/assets/foottraffic-map-poster.deadbeef.svg".to_string(),
        })
    }

    #[test]
    fn renders_map_figure_with_config_island_and_fallbacks() {
        let html = rendered().markup.into_string();
        assert!(html.contains(r#"<figure class="region-map" data-region-map"#));
        assert!(html.contains("data-region-map-canvas"));
        // Hoisted poster URL lands on the fallback image.
        assert!(html.contains(r#"src="/assets/foottraffic-map-poster.deadbeef.svg""#));
        assert!(html.contains("data-region-map-status"));
        // JSON config island the scrollspy-free Leaflet mount reads.
        assert!(html.contains(r#"<script type="application/json" data-region-map-config>"#));
        assert!(html.contains(r#""radiusMiles": 180"#));
        // escape_script_payload adoption is byte-neutral for this literal:
        // no escape sequences appear in the emitted island.
        assert!(!html.contains("\\u003c"));
        assert!(!html.contains("\\u2028"));
        // All four operators present in config, caption, and noscript text.
        for name in ["Matthew", "Marcus", "Jason", "Alex"] {
            assert!(html.matches(name).count() >= 3, "{name} missing");
        }
        assert!(html.contains("<noscript>"));
    }

    #[test]
    fn styles_critical_with_colocated_script() {
        let rendered = rendered();
        assert_eq!(rendered.critical_css, vec![STYLE]);
        assert!(rendered.deferred_css.is_empty());
        assert_eq!(rendered.js_deps, vec![SCRIPT]);
    }
}
