//! Subscribe-only planetary sculpture. SVG is the no-script/device-loss fallback;
//! WebGPU adds etched metal shading. Audio starts only from the sound button.
use super::Rendered;
pub use super::asset_names::armillary::{SCRIPT, STYLE};
use eng_markup::view;

pub fn render(texture_url: String) -> Rendered {
    let markup = view! {
        <div class="armillary" data-armillary data-texture={ texture_url.clone() }>
            <div class="armillary-art" aria-hidden="true">
                <img class="armillary-sunburst" src={ texture_url } width="768" height="768" alt="" decoding="async" />
                <svg class="armillary-poster" viewBox="0 0 800 800" fill="none" focusable="false">
                    <defs>
                        <radialGradient id="armillary-metal" cx=".3" cy=".2" r=".85"><stop stop-color="#a9b1a1" /><stop offset=".42" stop-color="#465651" /><stop offset="1" stop-color="#122524" /></radialGradient>
                        <linearGradient id="armillary-gold"><stop stop-color="#d8c59a" /><stop offset=".5" stop-color="#8b7850" /><stop offset="1" stop-color="#d6c6a1" /></linearGradient>
                    </defs>
                    <circle cx="400" cy="400" r="140" fill="url(#armillary-metal)" stroke="url(#armillary-gold)" />
                    <path d="m400 260-120 210 240 0Zm0 280-120-210 240 0ZM260 400h280M330 280l140 240m0-240L330 520" stroke="#c1bf9c" stroke-opacity=".35" />
                    <g stroke="url(#armillary-gold)" stroke-width="3"><ellipse cx="400" cy="400" rx="250" ry="83" transform="rotate(-28 400 400)" /><ellipse cx="400" cy="400" rx="230" ry="100" transform="rotate(65 400 400)" /><ellipse cx="400" cy="400" rx="270" ry="270" stroke-width="1" /><ellipse cx="400" cy="400" rx="205" ry="260" transform="rotate(25 400 400)" /></g>
                    <g stroke="#a3916c" stroke-width="1" opacity=".65"><path d="M400 99v36m0 530v36M99 400h36m530 0h36" /><circle cx="400" cy="400" r="300" stroke-dasharray="1 9" /></g>
                </svg>
                <canvas class="armillary-canvas" data-armillary-canvas></canvas>
            </div>
            <div class="armillary-controls">
                <span>"I / A little perspective"</span>
                <div>
                    <button type="button" data-armillary-motion hidden aria-pressed="false">"Pause orbit"</button>
                    <button type="button" data-armillary-sound hidden aria-pressed="false">"Sound off"</button>
                </div>
            </div>
            <span class="sr-only" data-armillary-audio-status role="status"></span>
        </div>
    };
    Rendered {
        markup,
        critical_css: vec![STYLE],
        deferred_css: vec![],
        js_deps: vec![SCRIPT],
    }
}
