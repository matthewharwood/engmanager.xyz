# HTML-in-Canvas: attributed article quote cards

The blog uses HTML-in-Canvas for a concrete reader task: taking a passage
into a slide or team discussion as a readable PNG with its article title,
author, and source URL. The same card is an ordinary HTML preview in every
browser that supports the dialog. PNG export uses the native experimental
API when available and an SVG compatibility renderer otherwise.

## Why this use case

| Candidate | Reader value | Decision |
|---|---|---|
| Quote cards | Save a short idea with attribution for a presentation or discussion. | Implemented. CSS handles wrapping, font layout, and theme colors once for both preview and export. |
| Diagram and wireframe snapshots | Put article models and their explanations into working notes. | Useful follow-up for mixed HTML figures; existing Mermaid/SVG diagrams can already be exported with established APIs. |
| Personality report images | Share a selected report finding. | Plausible, but the assessment has its own versioned export, consent, and report pipeline; outside this article enhancement. |
| HTML labels in animated hero canvases | Allow richer typography in the visual hero. | Deferred: it adds rendering complexity without helping the current reading task. |
| Canvas rendering of the whole article | Demonstrate the experimental API. | Rejected: normal HTML already serves reading, selection, search, scrolling, and accessibility well. |

Canvas has a specific job here: producing a downloadable raster image.
HTML keeps responsibility for text layout. This avoids shipping a screenshot
library or maintaining a second text renderer that manually wraps strings,
measures lines, and duplicates the CSS card layout.

## Reader flow

1. On an article, select a passage and choose **Make quote card** in the
   article tools. Without a selection, the tool uses an existing article
   passage. Each blockquote also has its own **Make quote card** action.
2. Review the card and its source. The **Quote + source** field is readonly;
   the tool does not offer an editor that could invent text under the
   author's name. Passages longer than 480 Unicode characters are shortened
   and the dialog says so.
3. Choose **Copy quote + link**. If clipboard access fails, the complete text
   is selected in the readonly field for manual copying.
4. Choose **Download PNG**, without changing browser flags. The file
   includes the visible attribution and URL. It is a local download; no
   passage or card is sent to a server.

The preview, PNG download, and copying remain available without HTML-in-Canvas.
If native rendering fails, the compatibility renderer gets one attempt. If
both exporters fail, the preview stays intact and the reader can retry or copy
the passage. The dialog supports Escape, an explicit close button, and focus
return to the action that opened it.

## Rendering and lifecycle

- Capability checks require `CanvasRenderingContext2D.prototype.drawElementImage`
  and `HTMLCanvasElement.prototype.requestPaint`; browser branding is not
  used to infer support.
- Export waits for the selected theme's decoded fonts and loading transition,
  then the document font set, measures the real preview, and temporarily moves
  that same artwork node inside a laid-out canvas. It does not hide the
  source using `display: none` or manually dispatch a synthetic paint event.
  Font loading and painting each have a five-second timeout; closing the
  dialog cancels either wait.
- The canvas receives both `layoutsubtree` and `content="drawable"`; its
  artwork receives `drawable`. These accommodate the earlier origin-trial
  shape and the updated explainer. An unknown attribute alone is not
  treated as support.
- Rendering runs in the native `paint` event after `requestPaint()`. The
  measured card is drawn with explicit destination dimensions at twice
  its CSS size. This bounds normal export size independently of the
  device's pixel ratio; the passage limit and responsive card also keep
  content size constrained. There is no continuous animation loop.
- Earlier implementations return a transform from `drawElementImage`; it
  is applied only when present. The newer proposal returns no matrix and
  synchronizes 2D element geometry automatically.
- The compatibility renderer clones only the text card, snapshots computed
  styles, and embeds its selected theme and display fonts from same-origin
  assets. It serializes the clone into an SVG `foreignObject` data URL, decodes
  the image, and uses standard `drawImage` and `toBlob` for a 2x PNG. HTML still
  handles text wrapping; no screenshot dependency or handwritten text renderer
  is needed. This is a scoped export fallback, not a global polyfill for the
  experimental drawing or paint APIs. It does not support arbitrary widgets,
  external images, or pseudo-elements added to the card in the future.
- The fallback has an eight-second timeout. Closing or navigating away aborts
  pending font fetches, discards the detached snapshot and canvas, and prevents
  a late download. The live preview is never moved by this renderer.
- A nonempty `toBlob(..., "image/png")` result precedes download. Paint
  failure or timeout restores the same HTML node. Closing the dialog or
  navigating away aborts the operation, removes page handlers and generated
  actions, and revokes outstanding object URLs.
- Only a successful export emits `engmanager:quote-card-export`, with a
  `detail.renderer` of `html-in-canvas` or `svg`. The Web API Receipt credits
  only a successful native export. A compatibility PNG does not claim the
  experimental API was used, even if native support was detected but failed.

Implementation lives in `website/src/components/quote_card/`, is mounted by
the article detail page, and is registered in
`website/experiences/manifest.toml` and `website/js/src/experiences.js`.

## Experimental availability and verification

The [Chrome announcement](https://developer.chrome.com/blog/html-in-canvas-origin-trial)
was updated in May 2026 and described an origin trial covering Chrome
148–150. Those historical version numbers are not a promise that an origin
trial is active now, or that the feature is generally available.

The [living WICG explainer](https://github.com/WICG/html-in-canvas/blob/main/README.md)
has since changed the canvas/descendant attributes and geometry API. It also
explicitly identifies media export as a use case. The implementation keeps
the earlier attribute and guarded transform handling while allowing the
newer form; it does not claim every evolving build has the same API.

The native export path was verified locally in Chrome 153 with
`--enable-blink-features=CanvasDrawElement` enabled. This demonstrates the
experimental implementation in that environment, not ordinary browser
availability. Keep a native export smoke test alongside unsupported-browser,
clipboard-failure, mobile layout, and soft-navigation checks when changing
this feature.

No origin-trial token is shipped. Using the native path for ordinary visitors
requires an applicable trial or browser release. PNG export itself needs no
trial because the compatibility path uses existing browser APIs. SVG images
must contain their own resources, including the dynamically loaded font bytes;
see [SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image).

Run the component, manifest, and native-browser checks with:

```sh
cargo test -p website --bin website
cargo test -p website --test quote_card_browser
```

The browser suite launches an isolated Chrome profile with the feature
explicitly disabled for fallback checks and enabled for native PNG checks.
It does not change the reader's browser settings.

Browser checks cover real PNG bytes and pixels in both renderers, a failed
native draw that recovers through SVG, honest receipt discovery, delayed theme
fonts, null-encoder recovery, timeout/cancellation, 320px layout, clipboard
denial, and modal Escape/focus restoration. Saved PNGs support visual inspection
of text, wrapping, fonts, and attribution. Chrome is the automated browser;
that does not establish identical rendering in every browser engine.
