# Supporting assets

Generated 19 September 2026. These are generic editorial assets, not personalized images or measurements. No answers or personal report scores were sent for generation.

| File | Purpose | Origin |
|---|---|---|
| `six-lenses-hero.png` | Article hero / report cover | Built-in `image_gen.imagegen` |
| `work-interests.png` | Interests introduction / report chapter | Built-in `image_gen.imagegen` |
| `section-complete.mp3` | Optional section completion cue | ElevenLabs text-to-sound-effects |
| `report-ready.mp3` | Optional report-ready cue | ElevenLabs text-to-sound-effects |

The complete image prompts are in [image-prompts.json](image-prompts.json). The images were visually reviewed for composition and absence of embedded scoring/text. The hero depicts six metaphorical lenses; the workbench depicts six activity motifs. Neither encodes measured data. Text, labels, score graphics and source attribution should be added with HTML/SVG/PDF text, never baked into these images.

Both sounds were generated as MP3 at 44.1 kHz and requested 128 kbps, without looping. Exact generation prompts:

- **Section completion, requested 0.6 seconds:** “A single very quiet, warm wooden tap with a soft felt mallet, a tiny airy tail. Minimal accessible interface section-complete cue. Calm neutral timbre, no voice, no music, no sharp high frequencies, no startling transients.”
- **Report ready, requested 1.5 seconds:** “A gentle two-note report-ready sound, soft felt piano and a faint warm glass resonance, understated resolved interval, brief natural fade. Calm and reflective, no triumphant fanfare, no voice, no bass boom or sharp transient. Minimal user interface sound.”

These are generated candidate cues; a human listening pass at the final playback gain is required before release. The design preview includes user-operated audio controls. Do not autoplay. Recommended initial app playback gain is 0.15, adjustable and muted by default. Never attach a better/worse sound to a trait score.

Asset file hashes, actual durations and stream metadata are recorded in `asset-manifest.json`. The PNG sources remain unmodified. Optimize copies for production after deciding the page/PDF size requirements, keeping the sources here. Confirm the connected account's permitted asset distribution terms as part of the normal release provenance review; do not assume the questionnaire licenses also license media.
