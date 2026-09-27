# Subscribe armillary

The subscribe page uses an armillary sphere: a faceted icosphere inside four
intersecting brass orbital rings. A generated solar engraving is woven into
its WebGPU material and appears as a restrained halo behind the geometry.
The typography and hairline form treatment share the 404/500 editorial feel.
The form submits to the existing Kit signup route; no signup or unsubscribe
behavior changes, and privacy/preferences pages do not load this component.

## Renderer

Native WebGPU, no graphics library or remote imports. The WGSL shader combines
faceted normals, derivative-antialiased seams, material sampling, a directional
light, specular/fresnel highlights, and a filmic highlight shoulder. The mesh is
7,232 triangles drawn in one call, with 4x MSAA. The canvas is capped at 650,000
pixels, device pixel ratio 1.25, and 30fps. The page pauses on hidden/offscreen
states and frees textures, buffers and device on navigation/pagehide. Reduced
motion renders a still frame; Pause orbit is always available when enhanced.

The embedded SVG provides first paint, no-script and GPU-failure artwork.
Shader failure/device loss do not disable the form or independent audio button.
The texture is a same-origin, content-hashed 768px WebP (123,742 bytes), reused
from the image cache for the GPU upload. No effect contacts an external service.

## Audio

Silent by default. A dedicated Sound off/on button creates/resumes Web Audio
in the user gesture. Sine tones at 55Hz and 82.41Hz, with a slow 0.065Hz volume
modulation and low gain (0.045). Fade in on enable, fade out and close the
context on mute, hidden tab, leaving the page or cleanup. It never resumes
sound automatically when returning. No microphone, audio file, or permission.

## Generated material

Built-in imagegen tool. Source:
`/Users/matthewharwood/.codex/generated_images/01a0dc6f-89e5-73f0-9657-23e0d61ab76d/exec-3d509fe6-b283-4336-9ddb-1723f095a7b7.png`.
Repo asset: `website/assets/newsletter/sunburst.webp` (downscaled and compressed).

Prompt:

> Use case: stylized-concept. Asset type: square material texture for a WebGPU armillary planet sculpture, also used as a static solar halo behind it. Primary request: a refined sacred sunburst, godly planetary radiance, subtle etched tapestry quality. Subject: centered luminous eclipse disk with a dense, intricate corona of hairline radial rays, concentric orbital engraving, gold filaments and microscopic mineral grain. No lettering or glyphs. Rays appear naturally irregular like solar plasma woven with antique brass engraving. Style: tactile astronomical instrument, quiet museum-quality metallic plate, highly detailed, abstraction over literal space photography. Palette: warm ivory, pale champagne, graphite, antique gold, near monochrome. Very dark charcoal background fading to black at edges, restrained luminosity. Composition: exact centered radial sunburst, generous empty dark outer margin, square. No UI, no text, no watermark, no extra planets.

## Validation

`armillary.test.mjs` covers silent startup, unsupported GPU, shader failure,
opt-in frequencies, mute, hidden tab, navigation, audio-resume races/failure,
and inert prerendering. Chrome review checks real WebGPU shader execution,
pause and AudioContext state transitions, desktop/mobile composition, and the
no-script fallback. Existing Rust signup-route and journey/theme browser tests
cover form availability, redirects, themes and navigation regressions.
