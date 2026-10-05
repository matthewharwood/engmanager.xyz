//! Subscribe-only planetary sculpture. SVG is the no-script/device-loss fallback;
//! WebGPU adds etched metal shading. Audio starts only from the sound button.
use super::Rendered;
pub use super::asset_names::armillary::{SCRIPT, STYLE};
use eng_markup::view;

pub fn render(texture_url: String) -> Rendered {
    let markup = view! {
        <div class={ classes!("armillary") } data-armillary data-texture={ texture_url.clone() }>
            <div class={ classes!("armillary-art") } aria-hidden="true">
                <img class={ classes!("armillary-sunburst") } src={ texture_url } width="768" height="768" alt="" decoding="async" />
                <picture class={ classes!("armillary-poster") }>
                    <source media="(max-width: 50rem)" srcset={ crate::asset_url("newsletter/observatory-mobile.svg") } />
                    <img src={ crate::asset_url("newsletter/observatory-desktop.svg") } width="620" height="600" alt="" decoding="async" />
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
        js_deps: vec![SCRIPT],
    }
}
