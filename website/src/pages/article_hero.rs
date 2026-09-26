//! A visual index of the essays. Each scene has one semantic mechanism, one
//! silhouette, and one print/signal treatment; the WebGL renderer supplies
//! motion while these inline SVGs remain useful without JavaScript or WebGL.

use eng_domain::HtmlFragment;
use eng_markup::view;

pub struct HeroSpec {
    pub slug: &'static str,
    pub name: &'static str,
    pub description: &'static str,
    pub poster: &'static str,
}

pub const HEROES: &[HeroSpec] = &[
    HeroSpec {
        slug: "auteurs",
        name: "CONFLUENCE",
        description: "A many-colored circle where people and disciplines converge",
        poster: r#"<circle cx="300" cy="170" r="122" fill="currentColor" opacity=".22"/><circle cx="300" cy="170" r="112" fill="none" stroke="currentColor" stroke-width="16"/><path d="M195 170c80-100 130 100 210 0M300 54c-80 75 80 155 0 232" fill="none" stroke="currentColor" stroke-width="7" opacity=".7"/>"#,
    },
    HeroSpec {
        slug: "autonomous-av-studio",
        name: "THE EDIT",
        description: "Two film strips sharing one clock, with frames feeding the next cut",
        poster: r#"<path d="M132 54v232m136-232v232m64-232v232m136-232v232" stroke="currentColor" stroke-width="3" opacity=".5"/><path d="M132 54h136v232H132zm200 0h136v232H332z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M133 112h134m-134 58h134m-134 58h134m66-116h134m-134 58h134m-134 58h134" stroke="currentColor" stroke-width="2" opacity=".7"/><path d="M205 83h195m-195 58h195m-195 58h195m-195 58h195" stroke="currentColor" stroke-width="5" opacity=".35"/>"#,
    },
    HeroSpec {
        slug: "big-personality",
        name: "SEVEN LENSES",
        description: "Seven overlapping lenses reveal a person without reducing them to one type",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="3"><ellipse cx="300" cy="170" rx="195" ry="49" transform="rotate(-51 300 170)"/><ellipse cx="300" cy="170" rx="195" ry="49" transform="rotate(-25 300 170)"/><ellipse cx="300" cy="170" rx="195" ry="49"/><ellipse cx="300" cy="170" rx="195" ry="49" transform="rotate(25 300 170)"/><ellipse cx="300" cy="170" rx="195" ry="49" transform="rotate(51 300 170)"/><circle cx="300" cy="170" r="101" stroke-dasharray="6 9"/><circle cx="300" cy="170" r="18"/></g>"#,
    },
    HeroSpec {
        slug: "claude-code-lsp",
        name: "REFERENCES",
        description: "A semantic graph exposes the references that a text search misses",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="2"><path d="M155 95 300 170 445 75M300 170 433 245M300 170 183 254M155 95 183 254M445 75 433 245" opacity=".55"/><circle cx="155" cy="95" r="18"/><circle cx="445" cy="75" r="18"/><circle cx="433" cy="245" r="18"/><circle cx="183" cy="254" r="18"/><rect x="267" y="137" width="66" height="66" rx="8" stroke-width="4"/><path d="M300 113v20m0 74v20m-63-57h26m74 0h26" stroke-width="3"/></g>"#,
    },
    HeroSpec {
        slug: "jsx-like-rust-macro",
        name: "EXPANSION",
        description: "Nested brackets and tokens expand from a small declarative rule",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><path d="m142 110-54 60 54 60m316-120 54 60-54 60"/><path d="m201 92-44 78 44 78m198-156 44 78-44 78" opacity=".7"/><rect x="242" y="108" width="116" height="124" rx="6"/><path d="M266 140h68m-68 30h44m-44 30h68" stroke-width="3"/></g>"#,
    },
    HeroSpec {
        slug: "mcp-blender-library-3d-print",
        name: "LAYER BY LAYER",
        description: "A little hammer hero takes shape one printable layer at a time",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="3"><path d="M175 282h250v16H175zm92-45h66v45h-66zm-26-52h118v53H241zm22-60h74v60h-74zm-14-20h102v20H249zm155-12h65v37h-65zm-40 16h40m-40 0v130"/><path d="M190 258h220M236 236h146M238 214h144M247 192h113M265 170h72M265 148h72" stroke-dasharray="6 5" opacity=".65"/></g>"#,
    },
    HeroSpec {
        slug: "project-foottraffic",
        name: "THE PLAZA",
        description: "A cluster of storefronts lights up neighboring blocks in a local grid",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="2"><path d="M70 84h460M70 170h460M70 256h460M160 48v244M300 48v244M440 48v244" opacity=".4"/><rect x="174" y="99" width="112" height="56" rx="5" stroke-width="5"/><rect x="314" y="185" width="112" height="56" rx="5"/><rect x="74" y="185" width="72" height="56" rx="5"/><path d="M230 158v34h140m-140-34v34H110" stroke-width="3" stroke-dasharray="5 7"/></g>"#,
    },
    HeroSpec {
        slug: "talking-not-typing",
        name: "SPOKEN INTO FORM",
        description: "A sound wave resolves into blocks of shipped work",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="4"><path d="M62 170h42l14-42 18 86 18-122 18 156 18-96 16 35 15-17h44" stroke-linecap="round" stroke-linejoin="round"/><path d="M282 98h70v44h-70zm86 0h70v44h-70zm-86 59h70v44h-70zm86 0h70v44h-70zm-86 59h70v44h-70zm86 0h70v44h-70z"/><path d="M248 170h26m174 0h75" stroke-dasharray="5 7"/></g>"#,
    },
    HeroSpec {
        slug: "the-casino-hypothesis",
        name: "ALMOST",
        description: "Three incomplete reels form a loop that never quite resolves",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="3"><rect x="146" y="55" width="308" height="230" rx="16"/><path d="M151 127h298M151 212h298"/><path d="M200 63v216m100-216v216m100-216v216" opacity=".45"/><circle cx="200" cy="170" r="29" stroke-width="7" stroke-dasharray="154 30"/><circle cx="300" cy="170" r="29" stroke-width="7" stroke-dasharray="154 30" transform="rotate(65 300 170)"/><circle cx="400" cy="170" r="29" stroke-width="7" stroke-dasharray="154 30" transform="rotate(-70 400 170)"/></g>"#,
    },
    HeroSpec {
        slug: "the-execution-marketplace",
        name: "THE CLEARING",
        description: "Three streams of work meet at one order book and flow back as reusable blocks",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M120 75 264 170 120 265m360-190L336 170l144 95M300 75v190" opacity=".7"/><path d="M263 127h74v86h-74z" stroke-width="5"/><path d="M280 152h40m-40 18h40m-40 18h40"/><circle cx="120" cy="75" r="11"/><circle cx="120" cy="265" r="11"/><circle cx="480" cy="75" r="11"/><circle cx="480" cy="265" r="11"/></g>"#,
    },
    HeroSpec {
        slug: "vibe-coding-a-shop",
        name: "ONE IN FOCUS",
        description: "A product grid gives way to one focused cap and a complete checkout",
        poster: r#"<g fill="none" stroke="currentColor" stroke-width="3"><rect x="90" y="78" width="250" height="192" rx="9"/><path d="M173 78v192m84-192v192M90 142h250M90 206h250" opacity=".5"/><rect x="173" y="142" width="84" height="64" fill="currentColor" fill-opacity=".12"/><path d="M215 181q-16-18 0-28 16 10 0 28"/><path d="M345 115 482 65m-137 180 137 50" stroke-dasharray="7 8" opacity=".6"/><rect x="480" y="55" width="74" height="240" rx="10"/><path d="M495 185q0-50 22-50t22 50m-44 0q22 11 44 0"/></g>"#,
    },
];

pub fn render(slug: &str) -> HtmlFragment {
    let spec = HEROES
        .iter()
        .find(|hero| hero.slug == slug)
        .expect("article hero missing");
    let poster = HtmlFragment::new(spec.poster.to_owned());
    view! {
        <figure class="article-hero-scene" data-article-hero=spec.slug role="img" aria-label=spec.description>
            <svg class="article-hero-poster" viewBox="0 0 600 340" aria-hidden="true" focusable="false">{ poster }</svg>
            <canvas class="article-hero-canvas" aria-hidden="true"></canvas>
            <figcaption aria-hidden="true"><span>"FIELD STUDY / "{ slug }</span><strong>{ spec.name }</strong></figcaption>
        </figure>
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::content::ARTICLES;
    use std::collections::HashSet;

    #[test]
    fn every_article_has_one_distinct_scene_and_accessible_fallback() {
        let slugs: HashSet<_> = HEROES.iter().map(|hero| hero.slug).collect();
        assert_eq!(slugs.len(), HEROES.len());
        assert_eq!(slugs, ARTICLES.iter().map(|article| article.slug).collect());
        for hero in HEROES {
            let html = render(hero.slug).into_string();
            assert!(html.contains(hero.description));
            assert!(html.contains("article-hero-poster"));
            assert!(html.contains("article-hero-canvas"));
        }
    }
}
