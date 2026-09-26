//! Decorative, local-only pyramid sculpture shared by the 404 and preferences
//! pages. The SVG is the first-paint/no-script fallback; the canvas enhancement
//! never reads URLs, forms, or subscriber state and makes no network requests.
use eng_markup::view;

use super::Rendered;

pub use super::asset_names::sigil::{SCRIPT, STYLE};

pub fn render(quiet: bool) -> Rendered {
    let markup = view! {
        <div class="sigil-scene" data-sigil-scene data-sigil-quiet={ if quiet { "true" } else { "false" } }>
            <svg class="sigil-poster" viewBox="0 0 800 800" fill="none" focusable="false" aria-hidden="true">
                <ellipse class="sigil-poster-orbit" cx="400" cy="395" rx="285" ry="285" />
                <ellipse class="sigil-poster-orbit" cx="400" cy="435" rx="330" ry="95" transform="rotate(-24 400 435)" />
                <path class="sigil-poster-edge" d="M400 103v47M400 650v47M82 395h47M671 395h47" />
                <path class="sigil-poster-side" d="m408 241 54 5 176 337-230 71Z" />
                <path class="sigil-poster-face" d="m408 241 230 342-385-36Z" />
                <path class="sigil-poster-cap" d="m408 141 62 92-98-9Z" />
                <path class="sigil-poster-edge" d="m408 241 230 342-385-36Zm-62 122 140 13m-176 58 220 21m-252 47 301 28m-171-289V141m0 407 230 35" />
                <path class="sigil-poster-eye" d="M343 402q70-66 142 12-70 48-142-12Z" />
                <ellipse class="sigil-poster-iris" cx="415" cy="405" rx="24" ry="28" transform="rotate(6 415 405)" />
                <ellipse class="sigil-poster-pupil" cx="415" cy="405" rx="9" ry="17" transform="rotate(6 415 405)" />
                <path class="sigil-poster-edge" d="m343 402-12-2m154 14 12 2m-82-53 2-17m-6 88-1 18" />
            </svg>
            <canvas class="sigil-canvas" data-sigil-canvas aria-hidden="true"></canvas>
            <button class="sigil-motion" type="button" data-sigil-motion hidden>"Pause animation"</button>
        </div>
    };
    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: vec![],
        js_deps: vec![SCRIPT],
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sculpture_has_a_decorative_fallback_without_remote_resources() {
        let result = render(true);
        let html = result.markup.as_str();
        assert!(html.contains("data-sigil-quiet=\"true\""));
        assert!(html.contains("data-sigil-canvas aria-hidden=\"true\""));
        assert!(html.contains("data-sigil-motion hidden"));
        assert!(html.contains("sigil-poster"));
        assert!(html.contains("<canvas"));
        assert!(!html.contains("http"));
        assert!(!html.contains("<script"));
    }
}
