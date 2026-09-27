# Theme materials

Each palette and body face now has twelve independently adjustable CSS properties.
The values live alongside the palettes in `website/css/src/critical.css`.
Auto uses the complete Light or Dark profile, including OS preference changes.

| Property | Applies to |
| --- | --- |
| `--radius-selector` | Search filter options, date controls, keyboard keys |
| `--radius-field` | Search and newsletter inputs/buttons |
| `--radius-box` | Search dialog/results, newsletter card, bio, keyboard, Discord card, receipt |
| `--size-field` | Form control minimum heights (2.75–2.875rem, with offsets for larger fields) |
| `--size-selector` | Filter and key padding |
| `--border` | Control and panel border width |
| `--depth` | Shadow opacity; zero makes Lofi flat |
| `--noise` | Static CSS grain opacity, from zero to 0.8 |
| `--shadow-offset` | Surface/control shadow displacement |
| `--shadow-blur` | Surface/control shadow softness |
| `--surface-opacity` | Search dialog surface opacity |
| `--glass-blur` | Search dialog and backdrop blur, 0–16px |

Catppuccin is soft and rounded; Cyberpunk is angular with crisp depth; Forest
has a quiet paper texture; Lofi is compact and flat; Luxury uses fine corners,
restrained depth, and grain. Light/Dark remain neutral, Synthwave has diffuse
depth, and Dracula sits between sharp and soft.

These are material changes, not a new layout scale. Navigation hit areas, type
sizes, reading widths, avatars, artwork and the self-contained error pages keep
their geometry. No effect uses JavaScript, new assets, SVG filters, or an animated
texture. Grain uses the existing tiled radial gradients, with alpha controlled
by `--noise`; surfaces use smaller blur bounds than the previous search dialog.

| Theme | Selector radius | Field radius | Box radius | Field height | Selector padding | Border | Depth | Grain | Shadow offset | Shadow blur | Surface opacity | Glass blur |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| light | .375rem | .5rem | .875rem | 2.75rem | .25rem | 1px | 1 | 0 | 2px | 8px | 96% | 12px |
| dark | .375rem | .5rem | .75rem | 2.75rem | .25rem | 1px | 1 | .15 | 2px | 12px | 94% | 14px |
| catppuccin | .625rem | .75rem | 1.25rem | 2.875rem | .3rem | 1px | 1 | .2 | 3px | 16px | 92% | 16px |
| synthwave | .25rem | .25rem | .5rem | 2.75rem | .25rem | 1px | 1 | .35 | 2px | 14px | 93% | 12px |
| cyberpunk | 0 | 0 | .125rem | 2.75rem | .225rem | 2px | 1 | 0 | 3px | 0px | 100% | 0px |
| forest | .5rem | .625rem | 1rem | 2.875rem | .3rem | 1px | 1 | .65 | 2px | 10px | 97% | 8px |
| lofi | .125rem | .125rem | .25rem | 2.75rem | .225rem | 1px | 0 | .45 | 0px | 0px | 100% | 0px |
| dracula | .25rem | .375rem | .625rem | 2.75rem | .25rem | 1px | 1 | .25 | 3px | 10px | 95% | 10px |
| luxury | .125rem | .25rem | .5rem | 2.875rem | .3rem | 1px | 1 | .8 | 1px | 8px | 98% | 6px |

Verification extends the existing real Chrome typography test to check computed
corners, borders, surface/depth and flat/glass behavior while cycling every theme.
The journey suite checks navigation and overlays at mobile and desktop sizes.
