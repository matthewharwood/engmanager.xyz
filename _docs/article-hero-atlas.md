# Article hero atlas

Every current article has an abstract field study after its title. The artwork explains a *relationship* in the essay rather than illustrating a noun. These are deterministic editorial visualizations; they do not display reader data or claim to compute the actual system described in the story.

## Shared grammar

- One framed scene, a restrained print register, a generous field of negative space, a small index caption, and one primary silhouette. The Auteurs scene retains its established circular format.
- Each scene uses a different computer science mechanism to determine geometry or motion. Its shape and treatment then express the article's argument. The mechanism is documented at the branch that draws it in `website/js/src/article-heroes.js`.
- Color is sampled from the live theme tokens, not from a separate list of eleven palettes. Paper, ink, accent, and two supporting colors form the same five-channel interface for every scene. Coverage-based treatments (halftone, raster, dither, grain) can be combined without changing a theme's hue identity.
- The same server-rendered inline SVG supplies an intentional static composition when JavaScript, WebGL2, or motion is unavailable. Canvas has no pointer capture; native touch scrolling continues over the frame. Reduced-motion renders one still frame. Invisible scenes pause, buffers have a size cap, and navigation releases their GL resources.
- Derive the scene's visual distance from the previous one along silhouette, rhythm, treatment, and spatial organization; repeat the shared grammar instead of repeating its image.

| Article | Content relationship | Unique algorithmic precedent | Silhouette and spatial rule | Treatment and movement |
| --- | --- | --- | --- | --- |
| Auteurs | Disciplines coauthor a coherent practice | Barycentric interpolation of a noisy field | Single convergent orb | Continuous color and very slow angular drift; preserves the original emblem's circular character |
| Autonomous AV studio | Many tasks must precede a finished edit | Topological scheduling | Two neighboring film strips and shared time axis | CRT register; frames light in dependency order |
| Big Six-Seven personality | Traits, interests, and values overlap without becoming a single type | Seven-seed Voronoi tessellation | Overlapping lenses and porous boundaries | Halftone portrait field, gentle boundary movement |
| Claude Code LSP | Semantic references extend beyond literal matches | Breadth-first graph traversal | Node-link constellation with a source and indirect targets | Signal dither; wavefront visits successive depths |
| JSX-like Rust macro | Declarative syntax expands through nesting | Recursive descent and parser stack depth | Brackets nested around one token | Dither; one parsing frame unfolds after another |
| MCP Blender 3D printing | A library object becomes a physical keepsake | Signed-distance unions and FDM layer sampling | Toy figure, hammer, and build plate | Halftone/layer lines expose the additive build |
| Project FootTraffic | A local storefront shapes adjacent blocks | Manhattan-distance flood fill | Urban lattice with one seed store | Halftone neighborhoods radiate by grid distance |
| Talking, not typing | Spoken ideas become discrete shipped artifacts | Harmonic synthesis followed by quantization | Wave to blocks | Dither turns continuous signal into a legible sequence |
| Casino hypothesis | Near-matches keep a loop alive | Near-absorbing state transition cycle | Three incomplete reels | TV raster; states linger near alignment but have no payout terminal |
| Execution marketplace | Work competes for a common execution point | Minimum-cost edge selection in a flow network | Inbound streams to a shared order book | Moving packets emphasize the lowest-cost route |
| Vibe coding a shop | A broad catalog narrows to a purchasable object | FLIP first/last layout interpolation | Product grid to one enlarged cap card | Fine print grid; focus grows while neighboring cells hold position |

## Shape and treatment algebra

The fragment program draws a common paper field and computes three coverage channels for each scene: accent, secondary, and ink. A scene's geometric algorithm fills those channels; theme tokens color them. Halftone, dither, CRT raster, and grain modify *coverage or luminance* afterward. A scene can therefore gain a treatment without changing its underlying motif, and a theme can change without retuning eleven hard-coded gradients. Saddle-like radial gradients belong in the paper stage and can be varied without changing silhouettes.

## Exploration record

The article content was read as a set, then candidates were checked from six directions: mechanism (what changes), geometry (what remains recognizable), material (print or signal), time (how the argument unfolds), interaction (what a pointer should reveal), and restraint (what still reads as a still). Three useful crossovers were graph wavefront × signal dither for semantic references, lattice growth × neighborhood halftone for FootTraffic, and layered distance fields × printed strata for Blender. The resulting atlas uses those plus eight distinct mechanisms; it avoids a uniform particle effect. PhotoMosh/Mosh Pro's treatment vocabulary was an inspiration for raster, halftone and signal texture, while the compositions and algorithms here are authored for these essays.

## Integration and acceptance

`article_hero::HEROES` is the server-side coverage and accessible poster registry. Its test compares the set of slugs with `content::ARTICLES`, including the private Big Six-Seven introduction. The renderer shares the same slug order and honors the existing soft-navigation lifecycle. On a narrow viewport, the frame stays inside the article column; its canvas cannot intercept scrolling. The browser journey checks a real rendered shader when WebGL2 is available, verifies a color change on theme cycling, and checks the frame at mobile sizes.
