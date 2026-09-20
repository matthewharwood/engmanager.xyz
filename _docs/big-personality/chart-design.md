# Report charts

Implemented in the standalone design preview on 19 September 2026. The [shadcn area gallery](https://ui.shadcn.com/charts/area) is the visual reference for gradient fills, quiet grids, compact controls, inspectable points and bordered cards. This implementation is original vanilla JavaScript, SVG and CSS; it copies no component code and adds no React, Recharts, CDN, telemetry or storage dependency.

## The three views

- **Personality:** five selectable trait cards with 1–5 means and mini dot tracks. The selected domain expands into a stepped area or bar chart of its 24 keyed scores. Bins are discrete values 1–5; y is item count with a shared baseline-zero axis. A common y maximum across all five domains keeps switches comparable. Native buttons expose each bin to pointer, touch and keyboard inspection, with a persistent readout and optional data table. The chart is not a population distribution, timeline, density estimate or percentile.
- **Work interests:** six canonical RIASEC gradient bars on the same 0–20 scale, with direct numeric labels and selectable activity descriptions. Investigative and Artistic remain tied. Their scores do not establish ability or job suitability.
- **Personal values:** ten dot tracks with connectors to the respondent's mean. The fixed axis is −4.5…+4.5 and zero is prominent. Both directions use the same purple treatment; direction is relative priority, not moral judgment. Selecting a value reveals its raw 1–6 mean and a short construct description. These dependent centered values never form a seven-trait total.

The chart selections, hover state and Area/Bars mode are temporary presentation controls. They do not change answers, scores, saved draft state or the preview's snapshot payload. Refresh or a copied snapshot opens the default chart presentation for the same underlying synthetic scores. Production exactness concerns canonical assessment state and reviewed content, not a transient tooltip or viewport.

## Files and data integrity

`report-charts.mjs` mounts the cards and interactive SVG. `report-charts.css` uses the existing paper/forest palette with blue interests and purple values. `report-chart-data.mjs` provides explicitly fictional, deterministic data. The 120 original item responses match exact bank IDs and reverse keys; the 24 keyed scores per domain produce the displayed counts and original preview means. Values derive from 20 synthetic portrait responses and center to zero. No data comes from the supplied private PDF.

The production implementation must pass validated scores and original keyed response arrays from its immutable report model. Do not manufacture item distributions or facets from a domain mean. Missing domains require an unavailable/completion state instead of a zero score. This preview's fixture is not a production scorer.

## Interaction and rendering

Native buttons retain Tab access, focus outlines, and pressed state. Arrow keys move among trait choices, frequency bins and profile rows; Home/End jump to their boundaries. Each frequency target carries a complete accessible count label, while the redundant SVG is hidden from accessibility APIs. Tooltips repeat the persistent readout. Interest/value labels and scores stay visible without hovering. Reduced-motion preferences suppress transitions.

A ResizeObserver redraws the SVG when the hidden report is shown or resized. Mobile trait choices scroll within the card, and the lower cards stack. Print styling removes transient controls and preserves the vector chart. Full production PDF and assistive-technology conformance testing remain separate release tasks.
