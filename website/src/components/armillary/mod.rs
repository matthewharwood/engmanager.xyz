//! Original Blender armillary, using the journey's marble renderer and a
//! matching static fallback. Audio starts only from the sound button.
use super::Rendered;
pub use super::asset_names::armillary::{SCRIPT, STYLE};
use eng_markup::view;

pub fn render() -> Rendered {
    let markup = view! {
        <div class={ classes!("armillary") } data-armillary data-model={ crate::asset_url("newsletter/armillary.glb") }>
            <div class={ classes!("armillary-art") } aria-hidden="true">
                <picture class={ classes!("armillary-poster") }>
                    <img src={ crate::asset_url("newsletter/armillary.webp") } width="1100" height="1300" alt="" decoding="async" />
                </picture>
                <canvas class={ classes!("armillary-canvas") } data-armillary-canvas></canvas>
            </div>
            <div class={ classes!("armillary-controls") }>
                <span>"I / A little perspective"</span>
                <div>
                    <button type="button" data-armillary-motion hidden aria-pressed="false">"Pause orbit"</button>
                    <button type="button" data-armillary-sound hidden aria-pressed="false">"Sound off"</button>
                </div>
            </div>
            <span class={ classes!("sr-only") } data-armillary-audio-status role="status"></span>
        </div>
    };
    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: vec![],
        js_deps: vec!["js/journey-poster-renderer.js", SCRIPT],
    }
}
