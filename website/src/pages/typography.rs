//! Figma typography page 594:177: one shared display face and nine body faces.
//! Only the two shared faces are preloaded. Theme URLs are inert JSON until selected.

use eng_domain::HtmlFragment;
use serde_json::json;

const DISPLAY: &str = "fonts/PPMonumentExtended-Black.woff2";
const REDACTED: &str = "fonts/Redacted-Regular.woff2";

const THEMES: [(&str, &str, &str); 9] = [
    ("light", "PP Neue Montreal", "PPNeueMontreal-Regular"),
    ("dark", "PP Mori", "PPMori-Regular"),
    ("catppuccin", "PP Editorial New", "PPEditorialNew-Regular"),
    ("synthwave", "PP Neue Machina", "PPNeueMachina-PlainRegular"),
    ("cyberpunk", "PP Fraktion Mono", "PPFraktionMono-Regular"),
    ("forest", "PP Woodland", "PPWoodland-Regular"),
    ("lofi", "PP Writer", "PPWriter-RegularText"),
    ("dracula", "PP Fragment", "PPFragment-TextRegular"),
    ("luxury", "PP Eiko", "PPEiko-Regular"),
];

pub fn resource_hints() -> HtmlFragment {
    let display = crate::asset_url(DISPLAY);
    let redacted = crate::asset_url(REDACTED);
    HtmlFragment::new(format!(
        r#"<link rel="preload" href="{display}" as="font" type="font/woff2" crossorigin><link rel="preload" href="{redacted}" as="font" type="font/woff2" crossorigin><style data-theme-font-faces>@font-face{{font-family:"PP Monument Extended";src:url("{display}") format("woff2");font-weight:900;font-style:normal;font-display:swap}}@font-face{{font-family:"Redacted";src:url("{redacted}") format("woff2");font-weight:400;font-style:normal;font-display:swap}}</style>"#
    ))
}

pub fn config() -> HtmlFragment {
    let themes: serde_json::Map<String, serde_json::Value> = THEMES
        .iter()
        .map(|(theme, family, file)| {
            (
                (*theme).to_owned(),
                json!({"family": family, "url": crate::asset_url(&format!("fonts/{file}.woff2"))}),
            )
        })
        .collect();
    crate::components::script_island("__engThemeFonts", &json!(themes).to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn all_figma_faces_resolve_but_only_shared_faces_are_eager() {
        let hints = resource_hints().into_string();
        assert_eq!(hints.matches("rel=\"preload\"").count(), 2);
        for (theme, family, file) in THEMES {
            let path = format!("fonts/{file}.woff2");
            let url = crate::asset_url(&path);
            assert_ne!(url, format!("/assets/{path}"), "missing {theme} font");
            assert!(!hints.contains(file));
            assert!(config().as_str().contains(family));
            assert!(config().as_str().contains(&url));
        }
    }
}
