# Modern CSS Features 2025: Comprehensive Research Guide

*Compiled: January 16, 2025*
*Research Sources: MDN, CSS-Tricks, Chrome for Developers, WebKit, Smashing Magazine, web.dev, Utopia.fyi*

---

## Table of Contents

1. [Container Queries](#container-queries)
2. [CSS Grid & Subgrid](#css-grid--subgrid)
3. [Utopia.fyi Fluid Design System](#utopiafyi-fluid-design-system)
4. [The :has() Selector](#the-has-selector)
5. [Cascade Layers (@layer)](#cascade-layers-layer)
6. [Native CSS Nesting](#native-css-nesting)
7. [Modern Color Functions](#modern-color-functions)
8. [Scroll-Driven Animations](#scroll-driven-animations)
9. [Anchor Positioning](#anchor-positioning)
10. [View Transitions API](#view-transitions-api)
11. [Trigonometric Functions](#trigonometric-functions)
12. [@property - Typed Custom Properties](#property---typed-custom-properties)
13. [Browser Support Summary](#browser-support-summary)
14. [Resources & References](#resources--references)

---

## Container Queries

### Overview

Container queries represent a fundamental shift in responsive design, allowing elements to respond to their parent container's size rather than the viewport. This enables truly modular, reusable components that adapt to any context.

### Browser Support (2025)

**Fully supported:** Chrome 105+, Edge 105+, Firefox 110+, Safari 16+
**Baseline:** Widely available since February 2023
**Browser Compatibility Score:** 82/100

### Core Syntax

#### Creating a Container

```css
/* Long form */
.article-container {
  container-name: article;
  container-type: inline-size;
}

/* Shorthand */
.article-container {
  container: article / inline-size;
}
```

**Container Types:**
- `inline-size` - Queries width (horizontal writing) or height (vertical writing)
- `size` - Queries both dimensions
- `normal` - Default, no containment

#### Writing Container Queries

```css
/* Named container with modern range syntax */
@container article (inline-size > 700px) {
  .card {
    grid-template-columns: 1fr 2fr;
  }
}

/* Unnamed (uses nearest ancestor container) */
@container (width > 500px) {
  .component {
    display: flex;
    gap: 2rem;
  }
}

/* Range queries (more readable) */
@container (400px <= inline-size <= 800px) {
  .element {
    /* Styles for containers between 400-800px */
  }
}
```

### Container Query Units

Relative sizing units based on container dimensions:

- `cqw` - 1% of container width
- `cqh` - 1% of container height
- `cqi` - 1% of container inline size
- `cqb` - 1% of container block size
- `cqmin` - Smaller of cqi or cqb
- `cqmax` - Larger of cqi or cqb

```css
.card {
  /* Responsive padding based on container */
  padding: clamp(1rem, 4cqi, 2rem);

  /* Fluid typography */
  font-size: clamp(1rem, 3cqi, 1.6rem);

  /* Dynamic gaps */
  gap: clamp(0.5rem, 2cqw, 1.5rem);
}
```

### Style Queries (Experimental)

Query custom property values to trigger styling:

```css
/* In HTML */
<div class="card" style="--featured: true">

/* In CSS */
@container style(--featured: true) {
  .card {
    background: linear-gradient(135deg, pink, deeppink);
    border: 2px solid deeppink;
  }
}
```

**Note:** Style queries work in Chrome/Edge but lack Safari and Firefox support as of January 2025.

### Nested Containers

Multiple containers can coexist with independent queries:

```css
.grid-container {
  container: layout / inline-size;
}

.article-container {
  container: article / inline-size;
}

/* Grid-level query */
@container layout (inline-size > 1200px) {
  .grid-container {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* Article-level query */
@container article (inline-size > 600px) {
  .article {
    display: grid;
    grid-template-columns: 200px 1fr;
  }
}
```

### Practical Use Cases

**Responsive Card Components:**
```css
.card-container {
  container: card / inline-size;
}

.card {
  display: grid;
  gap: 1rem;
}

/* Horizontal layout when space allows */
@container card (inline-size > 400px) {
  .card {
    grid-template-columns: 150px 1fr;
  }
}

/* Enhanced layout for larger containers */
@container card (inline-size > 600px) {
  .card {
    grid-template-columns: 200px 1fr;
    gap: 2rem;
  }

  .card__image {
    aspect-ratio: 3/4;
  }
}
```

**Responsive Navigation:**
```css
.nav-container {
  container: nav / inline-size;
}

.nav {
  display: flex;
  gap: 1rem;
}

@container nav (inline-size < 600px) {
  .nav {
    flex-direction: column;
  }

  .nav__item {
    width: 100%;
  }
}
```

### Container Queries vs Media Queries

**When to use Container Queries:**
- Component-level responsiveness
- Reusable components across different contexts
- Layout flexibility within page sections
- Design systems and component libraries

**When to use Media Queries:**
- User preferences (`prefers-color-scheme`, `prefers-reduced-motion`)
- Page-level layouts
- Print styles
- Device characteristics

**Best Practice:** Use both together - media queries for global concerns, container queries for component behavior.

---

## CSS Grid & Subgrid

### CSS Grid in 2025

#### Current State

According to the 2024 State of CSS Survey, **78% of developers now use Grid regularly** (up from 62% in 2021). CSS Grid is the preferred tool for complex two-dimensional layouts in 2025.

#### Grid vs Flexbox Decision Tree

```
Need a layout system?
├─ One-dimensional (row OR column)?
│  └─ Use Flexbox
│     Examples: Navigation bars, button groups, centered content
│
└─ Two-dimensional (rows AND columns)?
   └─ Use CSS Grid
      Examples: Page layouts, dashboards, galleries, card grids
```

**Best Practice:** Combine both - Grid for overall structure, Flexbox for components within grid cells.

#### Modern Grid Techniques (2025)

**1. Named Grid Areas (96%+ browser support)**

```css
.page-layout {
  display: grid;
  grid-template-areas:
    "header header header"
    "sidebar main aside"
    "footer footer footer";
  grid-template-columns: 250px 1fr 200px;
  grid-template-rows: auto 1fr auto;
  gap: 1rem;
  min-height: 100vh;
}

.header { grid-area: header; }
.sidebar { grid-area: sidebar; }
.main { grid-area: main; }
.aside { grid-area: aside; }
.footer { grid-area: footer; }
```

**2. Auto-Fit & Auto-Fill**

```css
/* Responsive grid without media queries */
.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
}

/* Difference between auto-fit and auto-fill */
.auto-fit {
  /* Collapses empty tracks, stretches items */
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
}

.auto-fill {
  /* Maintains empty tracks, items don't stretch */
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
}
```

**3. Grid Template Columns with Intrinsic Sizing**

```css
.dashboard {
  display: grid;
  /* min-content, max-content, fit-content */
  grid-template-columns:
    min-content      /* Sidebar: shrinks to narrowest content */
    1fr              /* Main: flexible */
    fit-content(300px); /* Aside: grows to content, max 300px */
  gap: 2rem;
}
```

**4. Dense Packing Algorithm**

```css
.masonry-style {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  grid-auto-flow: dense; /* Fills gaps with smaller items */
  gap: 1rem;
}

.item--large {
  grid-column: span 2;
  grid-row: span 2;
}
```

### CSS Subgrid

#### Browser Support (2025)

**Fully supported:** Chrome 118+, Edge 118+, Firefox 71+, Safari 16+
**Baseline:** Widely available since September 2023
**Browser Compatibility Score:** 85/100

This feature works across all three major browser engines as of September 15, 2023.

#### What is Subgrid?

Subgrid allows nested grids to inherit track sizing, templates, and names from their parent grid, enabling perfectly aligned nested layouts.

#### Basic Subgrid Syntax

```css
.parent-grid {
  display: grid;
  grid-template-columns: [col-1] 200px [col-2] 1fr [col-3] 200px [col-4];
  grid-template-rows: auto auto auto;
  gap: 1rem;
}

.subgrid-item {
  /* Span 2 columns of parent */
  grid-column: span 2;

  /* Create nested grid inheriting parent's columns */
  display: grid;
  grid-template-columns: subgrid;
  gap: inherit; /* Inherit parent's gap */
}
```

#### Practical Subgrid Examples

**Card Grid with Aligned Content:**
```css
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2rem;
}

.card {
  display: grid;
  grid-template-rows: subgrid; /* Align card sections across all cards */
  grid-row: span 3; /* Image, content, footer */
}

/* All images align horizontally */
.card__image { grid-row: 1; }
/* All content sections align */
.card__content { grid-row: 2; }
/* All footers align at bottom */
.card__footer { grid-row: 3; }
```

**Form Layout with Subgrid:**
```css
.form {
  display: grid;
  grid-template-columns: [labels] 150px [inputs] 1fr [help] 200px;
  gap: 1rem;
}

.form-group {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: 1 / -1; /* Span all columns */
}

.form-group label { grid-column: labels; }
.form-group input { grid-column: inputs; }
.form-group .help-text { grid-column: help; }
```

**Named Grid Lines with Subgrid:**
```css
.parent {
  display: grid;
  grid-template-columns:
    [sidebar-start] 250px
    [sidebar-end main-start] 1fr
    [main-end];
}

.child {
  display: grid;
  grid-template-columns: subgrid;
  grid-column: sidebar-start / main-end;
}

/* Child can reference parent's named lines */
.nested-element {
  grid-column: main-start / main-end;
}
```

#### Progressive Enhancement for Subgrid

```css
.card {
  display: grid;
  grid-template-rows: auto 1fr auto; /* Fallback */
}

@supports (grid-template-rows: subgrid) {
  .card-grid {
    display: grid;
    grid-template-rows: repeat(3, auto);
  }

  .card {
    grid-template-rows: subgrid;
    grid-row: span 3;
  }
}
```

---

## Utopia.fyi Fluid Design System

### Core Philosophy

Utopia represents a paradigm shift from breakpoint-based responsive design to **fluid, proportional scaling**. Instead of designing for arbitrary device sizes, the system enables mathematical harmony across all viewport widths.

**Three-Step Process:**
1. Define type and space scales for minimum viewport (e.g., 320px)
2. Define type and space scales for maximum viewport (e.g., 1500px)
3. Let CSS interpolate between these scales automatically

### Fluid Type Scales

#### The Modular Scale Approach

Rather than arbitrary font sizes at breakpoints, Utopia uses **modular scales** - mathematical ratios applied repeatedly to create harmonious typography.

**Common Ratios:**
- Minor Third (1.2) - Subtle scaling
- Major Third (1.25) - Balanced
- Perfect Fourth (1.333) - Common choice
- Golden Ratio (1.618) - Natural harmony

#### Type Scale Configuration

**Minimum viewport setup (320px):**
- Base size: 16px
- Scale ratio: 1.2 (Minor Third)

**Maximum viewport setup (1500px):**
- Base size: 20px
- Scale ratio: 1.25 (Major Third)

**Generated Scale:**
- Step -2: ~11px → ~13px
- Step -1: ~13px → ~16px
- Step 0 (base): 16px → 20px
- Step 1: ~19px → ~25px
- Step 2: ~23px → ~31px
- Step 3: ~28px → ~39px
- Step 4: ~34px → ~49px
- Step 5: ~40px → ~61px

#### CSS Implementation

```css
:root {
  /* Fluid type scale */
  --step--2: clamp(0.6944rem, 0.6578rem + 0.1831vi, 0.8rem);
  --step--1: clamp(0.8333rem, 0.7813rem + 0.2604vi, 1rem);
  --step-0: clamp(1rem, 0.9286rem + 0.3571vi, 1.25rem);
  --step-1: clamp(1.2rem, 1.1036rem + 0.4821vi, 1.5625rem);
  --step-2: clamp(1.44rem, 1.3113rem + 0.6435vi, 1.9531rem);
  --step-3: clamp(1.728rem, 1.5585rem + 0.8476vi, 2.4414rem);
  --step-4: clamp(2.0736rem, 1.8517rem + 1.1094vi, 3.0518rem);
  --step-5: clamp(2.4883rem, 2.2008rem + 1.4372vi, 3.8147rem);
}

/* Usage */
h1 { font-size: var(--step-5); }
h2 { font-size: var(--step-4); }
h3 { font-size: var(--step-3); }
h4 { font-size: var(--step-2); }
h5 { font-size: var(--step-1); }
body { font-size: var(--step-0); }
small { font-size: var(--step--1); }
```

### Fluid Space Palette

#### T-Shirt Sizing System

Utopia applies similar logic to spacing, using multipliers derived from body font size.

**Space Scale (based on --step-0):**
- 3XS: 0.25rem → 0.3125rem
- 2XS: 0.5rem → 0.625rem
- XS: 0.75rem → 0.9375rem
- S: 1rem → 1.25rem
- M: 1.5rem → 1.875rem
- L: 2rem → 2.5rem
- XL: 3rem → 3.75rem
- 2XL: 4rem → 5rem
- 3XL: 6rem → 7.5rem

#### Individual Space Values

```css
:root {
  --space-3xs: clamp(0.25rem, 0.2321rem + 0.0893vi, 0.3125rem);
  --space-2xs: clamp(0.5rem, 0.4643rem + 0.1786vi, 0.625rem);
  --space-xs: clamp(0.75rem, 0.6964rem + 0.2679vi, 0.9375rem);
  --space-s: clamp(1rem, 0.9286rem + 0.3571vi, 1.25rem);
  --space-m: clamp(1.5rem, 1.3929rem + 0.5357vi, 1.875rem);
  --space-l: clamp(2rem, 1.8571rem + 0.7143vi, 2.5rem);
  --space-xl: clamp(3rem, 2.7857rem + 1.0714vi, 3.75rem);
  --space-2xl: clamp(4rem, 3.7143rem + 1.4286vi, 5rem);
  --space-3xl: clamp(6rem, 5.5714rem + 2.1429vi, 7.5rem);
}
```

#### Space Pairs (Dramatic Scaling)

For more dramatic fluid changes, Utopia provides **space pairs** that interpolate between two different values:

```css
:root {
  /* S-M: 16px → 30px */
  --space-s-m: clamp(1rem, 0.7143rem + 1.4286vi, 1.875rem);

  /* M-L: 24px → 40px */
  --space-m-l: clamp(1.5rem, 1.1786rem + 1.6071vi, 2.5rem);

  /* L-XL: 32px → 60px */
  --space-l-xl: clamp(2rem, 1.4286rem + 2.8571vi, 3.75rem);

  /* XL-2XL: 48px → 80px */
  --space-xl-2xl: clamp(3rem, 2.1429rem + 4.2857vi, 5rem);
}

/* Usage */
.hero {
  padding-block: var(--space-xl-2xl); /* Dramatically scales */
}

.section {
  padding-block: var(--space-m-l);
}

.card {
  padding: var(--space-s-m);
  gap: var(--space-xs); /* Subtle scaling */
}
```

### Utopia Grid System

```css
:root {
  /* Grid configuration */
  --grid-max-width: 77.5rem;
  --grid-gutter: var(--space-s-l); /* Fluid gutter */
  --grid-columns: 12;
}

.grid {
  display: grid;
  grid-template-columns:
    minmax(var(--grid-gutter), 1fr)
    repeat(var(--grid-columns), minmax(0, calc(var(--grid-max-width) / var(--grid-columns))))
    minmax(var(--grid-gutter), 1fr);
  column-gap: var(--grid-gutter);
}

.grid > * {
  grid-column: 2 / -2; /* Default: full width within gutters */
}

.grid-item--narrow {
  grid-column: 4 / -4; /* Narrower content */
}
```

### Benefits of Utopia

**1. Minimal Code**
```css
/* Traditional approach - multiple breakpoints */
.heading {
  font-size: 1.5rem;
}
@media (min-width: 640px) {
  .heading { font-size: 2rem; }
}
@media (min-width: 1024px) {
  .heading { font-size: 2.5rem; }
}
@media (min-width: 1280px) {
  .heading { font-size: 3rem; }
}

/* Utopia approach - single declaration */
.heading {
  font-size: var(--step-3); /* Scales automatically */
}
```

**2. Design-Development Alignment**

Shared vocabulary:
- Designers specify "Step 3" for main headings
- Developers implement `var(--step-3)`
- Both reference same systematic scale

**3. Proportional Scaling**

All elements maintain mathematical relationships across all viewports:
```css
.card {
  padding: var(--space-m);        /* Scales proportionally */
  gap: var(--space-xs);           /* Maintains relationship */
}

.card__title {
  font-size: var(--step-2);       /* Scales with padding */
  margin-bottom: var(--space-2xs); /* Maintains proportion */
}
```

**4. Visual Consistency**

Every spacing and typography decision derives from intentional mathematical relationships rather than arbitrary pixel values.

### Implementation with Tailwind (Optional)

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        'step--2': 'var(--step--2)',
        'step--1': 'var(--step--1)',
        'step-0': 'var(--step-0)',
        'step-1': 'var(--step-1)',
        'step-2': 'var(--step-2)',
        'step-3': 'var(--step-3)',
        'step-4': 'var(--step-4)',
        'step-5': 'var(--step-5)',
      },
      spacing: {
        '3xs': 'var(--space-3xs)',
        '2xs': 'var(--space-2xs)',
        'xs': 'var(--space-xs)',
        's': 'var(--space-s)',
        'm': 'var(--space-m)',
        'l': 'var(--space-l)',
        'xl': 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        's-m': 'var(--space-s-m)',
        'm-l': 'var(--space-m-l)',
        'l-xl': 'var(--space-l-xl)',
      }
    }
  }
}
```

### Resources

- **Type Calculator:** https://utopia.fyi/type/calculator/
- **Space Calculator:** https://utopia.fyi/space/calculator/
- **Grid Calculator:** https://utopia.fyi/grid/calculator/
- **Blog:** https://utopia.fyi/blog/
- **Smashing Magazine Guide:** https://www.smashingmagazine.com/2021/04/designing-developing-fluid-type-space-scales/

---

## The :has() Selector

### Overview

The `:has()` selector was voted **"Most Used and Most Loved CSS Feature"** in the State of CSS 2025 report. It enables parent selection and conditional styling based on descendant elements.

### Browser Support (2025)

**Fully supported:** Chrome 106+, Edge 105+, Firefox 122+, Safari 15.5+
**Baseline:** Widely available since December 2023
**Browser Compatibility Score:** 88/100

### Basic Syntax

```css
/* Select parent that contains specific child */
parent:has(child) {
  /* Styles */
}

/* Multiple conditions */
parent:has(child1):has(child2) {
  /* Styles */
}

/* OR conditions */
parent:has(child1, child2) {
  /* Styles */
}
```

### Practical Use Cases

#### 1. Parent Selector - Icon Detection

```css
/* Style buttons differently if they contain icons */
button:has(.icon) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Button with only icon (no text) */
button:has(.icon):not(:has(span)) {
  padding: 0.5rem;
  aspect-ratio: 1;
}
```

#### 2. Card Layout Based on Content

```css
/* Default card layout */
.card {
  display: grid;
  gap: 1rem;
}

/* Card with image gets different layout */
.card:has(img) {
  grid-template-columns: 200px 1fr;
  grid-template-areas: "image content";
}

.card:has(img) img {
  grid-area: image;
}

.card:has(img) .card__content {
  grid-area: content;
}
```

#### 3. Form Validation Styling

```css
/* Style label when input is invalid */
label:has(+ input:invalid) {
  color: red;
}

/* Style fieldset containing invalid controls */
fieldset:has(input:invalid) {
  border-color: red;
}

fieldset:has(input:invalid) legend {
  color: red;
}

/* Success state */
label:has(+ input:valid) {
  color: green;
}

label:has(+ input:valid)::after {
  content: " ✓";
}
```

#### 4. Previous Sibling Selector

```css
/* Select all siblings before hovered item */
.nav-item:has(~ .nav-item:hover) {
  opacity: 0.5;
}

/* Or more specifically, immediate previous sibling */
.tab:has(+ .tab:hover) {
  border-right-color: transparent;
}
```

#### 5. Quantity Queries

```css
/* Style parent based on number of children */
ul:has(li:nth-child(n+6)) {
  /* More than 5 items - use columns */
  columns: 2;
}

ul:has(li:nth-child(n+11)) {
  /* More than 10 items - 3 columns */
  columns: 3;
}

/* Exactly 3 items */
ul:has(li:nth-child(3)):has(li:last-child:nth-child(3)) {
  display: flex;
  justify-content: space-between;
}
```

#### 6. The "All-But-Me" Selector

```css
/* Dim all cards except the one being hovered */
.card-grid:has(.card:hover) .card:not(:hover) {
  opacity: 0.5;
  scale: 0.98;
}

/* Apply only when not the focused element */
.nav:has(a:focus) a:not(:focus) {
  opacity: 0.6;
}
```

#### 7. Conditional Grid Layouts

```css
/* Two-column layout when both sections have content */
.container:has(.sidebar):has(.main) {
  display: grid;
  grid-template-columns: 250px 1fr;
}

/* Full-width when sidebar is empty */
.container:has(.sidebar:empty) {
  display: block;
}
```

#### 8. Figure with Caption

```css
figure {
  /* Default styles */
}

/* Add border when caption is present */
figure:has(figcaption) {
  border: 1px solid #ddd;
  padding: 1rem;
}

figure:has(figcaption) img {
  margin-bottom: 0.5rem;
}
```

#### 9. Nested List Styling

```css
/* Style list items that contain nested lists */
li:has(ul, ol) {
  margin-bottom: 1rem;
}

li:has(ul, ol) > span {
  font-weight: bold;
}
```

#### 10. Empty State Detection

```css
/* Show empty state message when section is empty */
.section:not(:has(*)) {
  display: grid;
  place-content: center;
  min-height: 200px;
}

.section:not(:has(*))::after {
  content: "No items to display";
  color: #666;
}
```

### Advanced Patterns

**Combining :has() with Container Queries:**
```css
@container (inline-size > 600px) {
  .card:has(img) {
    grid-template-columns: 300px 1fr;
  }
}
```

**Chaining Multiple :has() Conditions:**
```css
/* Article with image AND video */
article:has(img):has(video) {
  /* Special layout for rich media */
}

/* Form with errors AND touched fields */
form:has(input:invalid):has(input:not(:placeholder-shown)) {
  /* Show validation UI */
}
```

### Performance Considerations

While `:has()` is performant, avoid overly complex selectors:

```css
/* ✅ Good */
.container:has(.sidebar) {
  /* Simple, fast */
}

/* ⚠️ Use sparingly */
*:has(*:has(*:has(*))) {
  /* Very complex, slow */
}
```

---

## Cascade Layers (@layer)

### Overview

Cascade layers provide explicit control over CSS specificity, allowing you to organize styles into layers where **layer order trumps selector specificity**.

### Browser Support (2025)

**Fully supported:** Chrome 99+, Edge 99+, Firefox 97+, Safari 15.4+
**Baseline:** Widely available since March 2022

### Core Concept

Styles in later layers override earlier layers, **regardless of specificity**:

```css
@layer base {
  button { color: red; } /* Specificity: 0,0,1 */
}

@layer theme {
  button { color: blue; } /* WINS despite same specificity */
}
```

### Basic Syntax

#### Method 1: Define and Populate in One Step

```css
@layer utilities {
  .mt-1 { margin-top: 0.25rem; }
  .mt-2 { margin-top: 0.5rem; }
}
```

#### Method 2: Declare Order First, Populate Later

```css
/* Establish layer order */
@layer reset, base, theme, utilities;

/* Populate later in same file or different files */
@layer base {
  body { margin: 0; }
}

@layer theme {
  body { font-family: system-ui; }
}
```

#### Method 3: Anonymous Layers

```css
/* Cannot add styles to this layer later */
@layer {
  .temp-styles {
    /* Temporary or one-off styles */
  }
}
```

#### Method 4: Import with Layers

```css
@import url('reset.css') layer(reset);
@import url('theme.css') layer(theme);
```

### Nested Layers

```css
@layer framework {
  @layer base {
    /* framework.base */
  }

  @layer theme {
    /* framework.theme */
  }
}

/* Access nested layer */
@layer framework.base {
  /* Add more styles to framework.base */
}
```

### Practical Use Cases

#### Design System Organization

```css
/* Define layer order (most to least priority) */
@layer reset, base, components, utilities, overrides;

@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
  }
  body { margin: 0; }
}

@layer base {
  body {
    font-family: system-ui;
    line-height: 1.5;
  }

  h1, h2, h3 { line-height: 1.2; }
}

@layer components {
  .btn {
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
  }

  .card {
    background: white;
    border: 1px solid #ddd;
  }
}

@layer utilities {
  .text-center { text-align: center; }
  .flex { display: flex; }
}

@layer overrides {
  /* High-priority overrides when needed */
}
```

#### Third-Party Library Management

```css
/* Layer order establishes priority */
@layer normalize, bootstrap, custom;

@import url('normalize.css') layer(normalize);
@import url('bootstrap.css') layer(bootstrap);

@layer custom {
  /* Your styles automatically override Bootstrap */
  .btn {
    /* Lower specificity than Bootstrap, but higher layer = WINS */
  }
}
```

#### Framework Integration

```css
@layer tailwind-base, tailwind-components, tailwind-utilities, custom;

/* Tailwind layers imported */
@import 'tailwindcss/base' layer(tailwind-base);
@import 'tailwindcss/components' layer(tailwind-components);
@import 'tailwindcss/utilities' layer(tailwind-utilities);

/* Custom layer wins over all Tailwind */
@layer custom {
  .btn-primary {
    /* Overrides Tailwind without !important */
  }
}
```

### Layer Priority Rules

**Priority order (highest to lowest):**
1. Inline styles (`style="..."`)
2. Styles with `!important` (reverse layer order)
3. Unlayered styles
4. Layered styles (later layers win)
5. User agent styles

```css
@layer early, late;

@layer late {
  button { color: red; }        /* WINS - later layer */
}

@layer early {
  button#specific.button.btn {  /* Loses despite high specificity */
    color: blue;
  }
}

/* Unlayered styles beat all layers */
button { color: green; }        /* WINS over both layers */

/* Important reverses layer order */
@layer late {
  button { color: orange !important; } /* Loses */
}

@layer early {
  button { color: purple !important; } /* WINS - earlier layer */
}
```

### Real-World Example: Complete System

```css
/* 1. Establish architecture */
@layer reset, defaults, layouts, components, utilities, themes, overrides;

/* 2. Reset layer */
@layer reset {
  * { margin: 0; padding: 0; box-sizing: border-box; }
}

/* 3. Defaults layer */
@layer defaults {
  :root {
    --color-primary: #0066cc;
    --spacing-unit: 0.5rem;
  }

  body {
    font-family: system-ui;
    color: #333;
  }
}

/* 4. Layouts layer */
@layer layouts {
  .container {
    max-width: 1200px;
    margin-inline: auto;
    padding-inline: var(--spacing-unit);
  }

  .grid {
    display: grid;
    gap: var(--spacing-unit);
  }
}

/* 5. Components layer */
@layer components {
  .btn {
    padding: calc(var(--spacing-unit) * 2);
    background: var(--color-primary);
    color: white;
  }

  .card {
    padding: calc(var(--spacing-unit) * 4);
    background: white;
  }
}

/* 6. Utilities layer */
@layer utilities {
  .sr-only { position: absolute; width: 1px; }
  .text-center { text-align: center; }
}

/* 7. Theme layer (runtime switching) */
@layer themes {
  [data-theme="dark"] {
    --color-primary: #66aaff;
    background: #1a1a1a;
    color: white;
  }
}

/* 8. Overrides layer (escape hatch) */
@layer overrides {
  /* High-priority fixes without !important */
}
```

### Debug and Inspect Layers

Browser DevTools show layer information (Chrome 99+, Firefox 97+):

```css
@layer debug {
  * {
    outline: 1px solid red;
  }
}
```

You can toggle layers on/off in DevTools to understand cascade behavior.

---

## Native CSS Nesting

### Overview

Native CSS nesting eliminates the need for preprocessors, allowing you to write nested selectors directly in CSS.

### Browser Support (2025)

**Fully supported:** Chrome 112+, Edge 112+, Firefox 117+, Safari 16.5+
**Baseline:** Widely available since August 2023
**Browser Compatibility Score:** 75/100

All modern desktop browsers now support native CSS nesting as of September 2023.

### Basic Syntax

#### Simple Nesting

```css
.nav {
  display: flex;
  gap: 1rem;

  a {
    color: inherit;
    text-decoration: none;
    padding: 0.5rem 1rem;
  }
}
```

#### Using the & Symbol (Recommended)

The ampersand (`&`) represents the parent selector. While optional in many cases, it's recommended for compatibility:

```css
.button {
  padding: 0.5rem 1rem;

  /* & is optional but recommended */
  & span {
    font-weight: bold;
  }

  /* & is required for pseudo-classes */
  &:hover {
    background: blue;
  }

  /* & is required for modifiers */
  &.primary {
    background: green;
  }
}
```

### Pseudo-Classes and Pseudo-Elements

```css
button {
  padding: 1rem;
  background: white;

  &:hover {
    background: lightblue;
  }

  &:focus {
    outline: 2px solid blue;
  }

  &:active {
    scale: 0.98;
  }

  &::before {
    content: "→ ";
  }

  &::after {
    content: " ←";
  }
}
```

### Media Queries Nesting

```css
.card {
  padding: 1rem;

  @media (min-width: 768px) {
    padding: 2rem;
    display: flex;
  }

  @media (prefers-color-scheme: dark) {
    background: #1a1a1a;
    color: white;
  }
}
```

### Container Queries Nesting

```css
.component {
  container: component / inline-size;

  @container (inline-size > 400px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  @container (inline-size > 800px) {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Complex Nesting Examples

#### BEM-Style Component

```css
.card {
  border: 1px solid #ddd;
  padding: 1rem;

  &__header {
    border-bottom: 1px solid #eee;
    padding-bottom: 0.5rem;
  }

  &__title {
    font-size: 1.5rem;
    margin: 0;
  }

  &__body {
    padding: 1rem 0;
  }

  &__footer {
    border-top: 1px solid #eee;
    padding-top: 0.5rem;
    display: flex;
    gap: 0.5rem;
  }

  &--featured {
    border-color: gold;
    border-width: 2px;
  }
}
```

#### Form with Validation

```css
.form-field {
  margin-bottom: 1rem;

  & label {
    display: block;
    margin-bottom: 0.25rem;
    font-weight: 500;
  }

  & input,
  & textarea {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;

    &:focus {
      outline: 2px solid blue;
      outline-offset: 2px;
    }

    &:invalid {
      border-color: red;
    }

    &:valid {
      border-color: green;
    }
  }

  & .error {
    color: red;
    font-size: 0.875rem;
    margin-top: 0.25rem;
  }

  &:has(input:invalid) {
    & label {
      color: red;
    }
  }
}
```

#### Navigation with States

```css
.nav {
  display: flex;
  gap: 1rem;

  &__item {
    position: relative;

    & a {
      padding: 0.5rem 1rem;
      color: inherit;
      text-decoration: none;

      &:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      &[aria-current="page"] {
        font-weight: bold;

        &::after {
          content: "";
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: currentColor;
        }
      }
    }

    &:has(ul) {
      /* Has dropdown */
      & > a::after {
        content: " ▾";
      }
    }

    & ul {
      position: absolute;
      top: 100%;
      left: 0;
      opacity: 0;
      pointer-events: none;

      @media (min-width: 768px) {
        /* Desktop dropdown */
      }
    }

    &:hover ul {
      opacity: 1;
      pointer-events: auto;
    }
  }
}
```

### Combining with Cascade Layers

```css
@layer components {
  .button {
    padding: 0.5rem 1rem;

    @layer variants {
      &.primary {
        background: blue;
        color: white;
      }

      &.secondary {
        background: gray;
        color: white;
      }
    }

    @layer states {
      &:hover { opacity: 0.9; }
      &:disabled { opacity: 0.5; }
    }
  }
}
```

### Browser Compatibility Considerations

**Always use `&` for maximum compatibility:**

```css
/* ❌ May not work in all browsers */
.parent {
  .child { }
}

/* ✅ Guaranteed compatibility */
.parent {
  & .child { }
}
```

### Limitations

1. **Cannot nest type selectors directly** (without `&`)
```css
/* ❌ Invalid */
article {
  section { }
}

/* ✅ Valid */
article {
  & section { }
}
```

2. **Cannot start with an identifier** (without `&`)
```css
/* ❌ Invalid */
.parent {
  .child-class { }
}

/* ✅ Valid */
.parent {
  & .child-class { }
}
```

---

## Modern Color Functions

### color-mix()

#### Browser Support (2025)

**Fully supported:** Chrome 111+, Edge 111+, Firefox 113+, Safari 16.4+
**Baseline:** Widely available since March 2024

#### Basic Syntax

```css
/* Mix two colors in specified color space */
background: color-mix(in oklch, red 60%, blue 40%);

/* Equal mix (percentages optional) */
background: color-mix(in oklch, purple, plum);

/* Only one percentage needed (other is calculated) */
background: color-mix(in srgb, red 25%, blue);
```

#### Color Spaces

Available color spaces for mixing:

**RGB-based:**
- `srgb` - Standard RGB
- `srgb-linear` - Linear RGB
- `display-p3` - Wide gamut

**Lab/LCH:**
- `lab` - Lightness, a-axis, b-axis
- `oklch` - Perceptually uniform cylindrical
- `oklab` - Perceptually uniform rectangular
- `lch` - Lightness, chroma, hue

**Legacy:**
- `hsl` - Hue, saturation, lightness
- `hwb` - Hue, whiteness, blackness
- `xyz` - CIE XYZ

#### OKLCH - Recommended for Mixing

OKLCH produces the most visually accurate mixes:

```css
/* Avoids muddy middle colors */
.gradient {
  background: linear-gradient(
    to right,
    oklch(0.7 0.2 30),
    color-mix(in oklch, oklch(0.7 0.2 30) 50%, oklch(0.5 0.3 270)),
    oklch(0.5 0.3 270)
  );
}
```

#### Hue Interpolation Methods

For polar color spaces (hsl, hwb, lch, oklch):

```css
/* shorter hue (default) - shortest path around color wheel */
color-mix(in oklch shorter hue, blue, yellow);

/* longer hue - longest path */
color-mix(in oklch longer hue, blue, yellow);

/* increasing hue - clockwise */
color-mix(in oklch increasing hue, blue, yellow);

/* decreasing hue - counter-clockwise */
color-mix(in oklch decreasing hue, blue, yellow);
```

#### Practical Examples

**Theme Color Variations:**
```css
:root {
  --color-primary: oklch(0.5 0.2 250);

  /* Lighter variant */
  --color-primary-light: color-mix(
    in oklch,
    var(--color-primary) 50%,
    white
  );

  /* Darker variant */
  --color-primary-dark: color-mix(
    in oklch,
    var(--color-primary) 70%,
    black
  );

  /* Desaturated variant */
  --color-primary-muted: color-mix(
    in oklch,
    var(--color-primary) 60%,
    gray
  );
}
```

**Interactive States:**
```css
.button {
  --button-bg: oklch(0.6 0.2 220);
  background: var(--button-bg);

  &:hover {
    background: color-mix(
      in oklch,
      var(--button-bg) 80%,
      white
    );
  }

  &:active {
    background: color-mix(
      in oklch,
      var(--button-bg) 90%,
      black
    );
  }
}
```

**Dynamic Color Palettes:**
```css
:root {
  --base-hue: 200;

  /* Generate complementary colors */
  --color-1: oklch(0.6 0.2 calc(var(--base-hue) + 0));
  --color-2: oklch(0.6 0.2 calc(var(--base-hue) + 120));
  --color-3: oklch(0.6 0.2 calc(var(--base-hue) + 240));

  /* Mix with base for variations */
  --accent: color-mix(
    in oklch,
    var(--color-1) 70%,
    var(--color-2) 30%
  );
}
```

### oklch() Color Space

#### Advantages

1. **Perceptually Uniform** - Equal numerical changes = equal perceived changes
2. **Wide Gamut** - Access to more vivid colors
3. **Predictable Lightness** - L value accurately represents perceived brightness
4. **Better for Accessibility** - Easier to maintain contrast ratios

#### Syntax

```css
oklch(Lightness Chroma Hue / Alpha)
```

- **Lightness (L):** 0 (black) to 1 (white)
- **Chroma (C):** 0 (gray) to 0.4+ (vivid)
- **Hue (H):** 0-360 degrees
- **Alpha:** 0 (transparent) to 1 (opaque)

#### Examples

```css
:root {
  /* Vibrant colors */
  --red: oklch(0.6 0.25 30);
  --green: oklch(0.7 0.2 140);
  --blue: oklch(0.5 0.2 250);

  /* Pastels (low chroma) */
  --pastel-pink: oklch(0.85 0.1 15);
  --pastel-blue: oklch(0.8 0.08 240);

  /* Earth tones */
  --brown: oklch(0.4 0.08 60);
  --tan: oklch(0.7 0.06 80);

  /* Grayscale (zero chroma) */
  --gray-100: oklch(0.95 0 0);
  --gray-500: oklch(0.5 0 0);
  --gray-900: oklch(0.15 0 0);
}
```

#### Color Contrast with OKLCH

```css
/* Maintain consistent contrast */
:root {
  --text-on-light: oklch(0.2 0 0);  /* Dark text */
  --text-on-dark: oklch(0.95 0 0);   /* Light text */
}

/* Accessible color pairs */
.card {
  --bg: oklch(0.95 0.05 200);
  --text: oklch(0.3 0.1 200); /* Same hue, different lightness */

  background: var(--bg);
  color: var(--text);
}
```

---

## Scroll-Driven Animations

### Overview

Scroll-driven animations link animation progress to scroll position, enabling effects like parallax, scroll progress indicators, and reveal animations—all with CSS, no JavaScript required.

### Browser Support (2025)

**Supported:** Chrome 115+, Edge 115+, Safari 26 beta
**In Progress:** Firefox (behind flag)
**Baseline:** Not yet (Safari support just added in beta)

### Core Concepts

Two timeline types:

1. **scroll()** - Linked to scroll container position
2. **view()** - Linked to element visibility in viewport

### Basic Scroll Timeline

```css
.animated-element {
  animation: slide-in linear;
  animation-timeline: scroll(); /* Links to nearest scroll container */
}

@keyframes slide-in {
  from {
    opacity: 0;
    transform: translateY(50px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Named Scroll Timeline

```css
.scroll-container {
  scroll-timeline-name: --container-scroll;
  scroll-timeline-axis: block; /* or inline, y, x */
  overflow-y: auto;
}

.element {
  animation: fade-in linear;
  animation-timeline: --container-scroll;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

### View Timeline

Animates based on element's position in viewport:

```css
.reveal-on-scroll {
  animation: reveal linear;
  animation-timeline: view();
  animation-range: entry 0% cover 50%;
}

@keyframes reveal {
  from {
    opacity: 0;
    scale: 0.8;
  }
  to {
    opacity: 1;
    scale: 1;
  }
}
```

### Animation Range

Control which portion of scroll triggers animation:

```css
.element {
  animation: slide linear;
  animation-timeline: view();

  /* Start when element enters, end at 50% visibility */
  animation-range: entry 0% cover 50%;
}

/* Available range keywords */
animation-range: cover;        /* Element is in view */
animation-range: contain;      /* Element fully in view */
animation-range: entry;        /* Element entering view */
animation-range: exit;         /* Element leaving view */
animation-range: entry-crossing; /* Entry point crossing */
animation-range: exit-crossing;  /* Exit point crossing */
```

### Practical Examples

#### Scroll Progress Indicator

```css
.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 4px;
  background: linear-gradient(to right, blue, purple);
  transform-origin: left;

  animation: grow-progress linear;
  animation-timeline: scroll(root); /* Track document scroll */
}

@keyframes grow-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

#### Parallax Effect

```css
.parallax-container {
  scroll-timeline: --parallax block;
}

.parallax-bg {
  animation: parallax linear;
  animation-timeline: --parallax;
}

@keyframes parallax {
  from { transform: translateY(0); }
  to { transform: translateY(-200px); }
}

.parallax-fg {
  animation: parallax-fast linear;
  animation-timeline: --parallax;
}

@keyframes parallax-fast {
  from { transform: translateY(0); }
  to { transform: translateY(-400px); }
}
```

#### Card Reveal on Scroll

```css
.card {
  animation: card-reveal linear;
  animation-timeline: view();
  animation-range: entry 0% cover 40%;
}

@keyframes card-reveal {
  from {
    opacity: 0;
    transform: translateY(100px) scale(0.9);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
```

#### Image Zoom on Scroll

```css
.image-zoom {
  overflow: hidden;
}

.image-zoom img {
  animation: zoom linear;
  animation-timeline: view();
  animation-range: entry 0% exit 100%;
}

@keyframes zoom {
  from { scale: 1.5; }
  to { scale: 1; }
}
```

#### Rotating Elements

```css
.rotate-on-scroll {
  animation: rotate linear;
  animation-timeline: scroll();
}

@keyframes rotate {
  from { rotate: 0deg; }
  to { rotate: 360deg; }
}
```

#### Staggered Reveals

```css
.list-item {
  animation: fade-slide linear;
  animation-timeline: view();
  animation-range: entry 0% cover 30%;
}

.list-item:nth-child(1) { animation-delay: 0s; }
.list-item:nth-child(2) { animation-delay: 0.1s; }
.list-item:nth-child(3) { animation-delay: 0.2s; }

@keyframes fade-slide {
  from {
    opacity: 0;
    transform: translateX(-50px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Progressive Enhancement

```css
@supports (animation-timeline: scroll()) {
  .enhanced {
    animation: enhanced-effect linear;
    animation-timeline: scroll();
  }
}

/* Fallback for unsupported browsers */
@supports not (animation-timeline: scroll()) {
  .enhanced {
    /* Static styles or JavaScript fallback */
  }
}
```

### Resources

- **Demos:** https://scroll-driven-animations.style/
- **Chrome Guide:** https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- **MDN:** https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-timeline

---

## Anchor Positioning

### Overview

CSS Anchor Positioning enables precise positioning of elements relative to other elements (anchors), perfect for tooltips, popovers, and dropdowns.

### Browser Support (2025)

**Supported:** Chrome 125+, Edge 125+
**In Progress:** Safari (WebKit blog shows development)
**Not Yet:** Firefox

**Note:** The property was renamed from `inset-area` to `position-area` in Chrome 129.

### Core Concepts

**Anchor Elements:** Reference elements that others position against
**Positioned Elements:** Elements that position themselves relative to anchors

### Basic Syntax

#### Define an Anchor

```css
.anchor-element {
  anchor-name: --my-anchor;
}
```

#### Position Relative to Anchor

```css
.positioned-element {
  position: absolute;
  position-anchor: --my-anchor;

  /* Position using anchor() function */
  top: anchor(bottom);
  left: anchor(left);
}
```

### The anchor() Function

Returns a length value based on anchor's position:

```css
/* Anchor sides: top, right, bottom, left */
/* Anchor sizes: width, height */

.tooltip {
  position: absolute;
  position-anchor: --button;

  /* Position below anchor */
  top: anchor(bottom);

  /* Align left edge with anchor */
  left: anchor(left);

  /* Center horizontally */
  left: anchor(center);
  transform: translateX(-50%);
}
```

### The position-area Property

Grid-based positioning (3×3 grid around anchor):

```css
/*
  top-left    top         top-right
  left        center      right
  bottom-left bottom      bottom-right
*/

.tooltip {
  position: absolute;
  position-anchor: --button;

  /* Position in top-center tile */
  position-area: top;
}

.dropdown {
  position: absolute;
  position-anchor: --menu-button;

  /* Position in bottom-left tile */
  position-area: bottom left;
}
```

#### Position Area Values

**Logical values:**
```css
position-area: block-start;        /* Top in LTR */
position-area: block-end;          /* Bottom in LTR */
position-area: inline-start;       /* Left in LTR */
position-area: inline-end;         /* Right in LTR */

/* Spanning */
position-area: block-end span-inline-end; /* Bottom-right */
position-area: span-all;           /* All 9 tiles */
```

### Practical Examples

#### Tooltip

```css
.button {
  anchor-name: --tooltip-anchor;
}

.tooltip {
  position: absolute;
  position-anchor: --tooltip-anchor;
  position-area: top;

  /* Center align */
  justify-self: center;

  /* Styling */
  background: black;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 0.25rem;

  /* Arrow pointing down */
  &::after {
    content: "";
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: black;
  }
}
```

#### Dropdown Menu

```css
.menu-button {
  anchor-name: --dropdown-anchor;
}

.dropdown {
  position: absolute;
  position-anchor: --dropdown-anchor;

  /* Below button, aligned to start */
  position-area: bottom span-inline-start;

  /* Minimum width of anchor */
  min-width: anchor-size(width);

  /* Styling */
  background: white;
  border: 1px solid #ddd;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  /* Hidden by default */
  display: none;
}

.menu-button:focus + .dropdown,
.dropdown:hover {
  display: block;
}
```

#### Popover

```css
.trigger {
  anchor-name: --popover-anchor;
}

.popover {
  position: absolute;
  position-anchor: --popover-anchor;
  position-area: right;

  /* Add spacing from anchor */
  margin-left: 1rem;

  /* Size based on anchor */
  max-height: anchor-size(height);
}
```

#### Dynamic Positioning (Fallback)

```css
.tooltip {
  position: absolute;
  position-anchor: --anchor;

  /* Try top first */
  position-area: top;

  /* Fallback positions if doesn't fit */
  position-try-fallbacks: bottom, left, right;
}
```

### Size Based on Anchor

```css
.element {
  /* Match anchor width */
  width: anchor-size(width);

  /* Half of anchor height */
  height: calc(anchor-size(height) / 2);

  /* Minimum width of anchor */
  min-width: anchor-size(width);
}
```

### Multiple Anchors

```css
.element {
  position: absolute;

  /* Default anchor */
  position-anchor: --anchor-1;

  /* Use different anchors for different properties */
  top: anchor(--anchor-2 bottom);
  left: anchor(--anchor-1 left);
}
```

### Progressive Enhancement

```css
@supports (anchor-name: --test) {
  /* Use anchor positioning */
  .tooltip {
    position: absolute;
    position-anchor: --button;
    position-area: top;
  }
}

@supports not (anchor-name: --test) {
  /* Fallback positioning */
  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
  }
}
```

---

## View Transitions API

### Overview

The View Transitions API enables smooth, animated transitions between page states or different pages, creating app-like experiences without JavaScript animation libraries.

### Browser Support (2025)

**Level 1 (Same-Document):** Chrome 111+, Edge 111+, Safari 18+, Firefox 144 beta
**Level 2 (Cross-Document):** Chrome 126+, Edge 126+, Safari 18.2+

### Same-Document Transitions (SPAs)

#### Basic Usage

```javascript
// Check for support
if (!document.startViewTransition) {
  // Fallback: update DOM directly
  updateTheDOM();
  return;
}

// Wrap DOM update in transition
document.startViewTransition(() => {
  updateTheDOM();
});
```

#### CSS for Transitions

```css
/* Default fade transition (automatic) */
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 0.3s;
}

/* Customize default transition */
::view-transition-old(root) {
  animation: fade-out 0.3s ease-out;
}

::view-transition-new(root) {
  animation: fade-in 0.3s ease-in;
}

@keyframes fade-out {
  to { opacity: 0; }
}

@keyframes fade-in {
  from { opacity: 0; }
}
```

#### Named Transitions

Target specific elements for unique animations:

```css
/* Mark elements for transitions */
.hero-image {
  view-transition-name: hero;
}

.page-title {
  view-transition-name: title;
}

/* Animate named transitions */
::view-transition-old(hero) {
  animation: scale-down 0.4s ease-out;
}

::view-transition-new(hero) {
  animation: scale-up 0.4s ease-in;
}

@keyframes scale-down {
  to {
    scale: 0.8;
    opacity: 0;
  }
}

@keyframes scale-up {
  from {
    scale: 0.8;
    opacity: 0;
  }
}
```

#### Practical SPA Example

```html
<div class="card-grid">
  <div class="card" style="view-transition-name: card-1">
    <img src="image1.jpg" style="view-transition-name: img-1">
    <h3 style="view-transition-name: title-1">Title</h3>
  </div>
</div>

<div class="detail-view" hidden>
  <img src="image1.jpg" style="view-transition-name: img-1">
  <h1 style="view-transition-name: title-1">Title</h1>
  <p>Details...</p>
</div>
```

```javascript
async function expandCard(cardElement) {
  const transition = document.startViewTransition(() => {
    cardElement.classList.add('hidden');
    detailView.classList.remove('hidden');
  });

  await transition.finished;
}
```

### Cross-Document Transitions (MPAs)

#### Enable via CSS

```css
/* Opt-in to cross-document transitions */
@view-transition {
  navigation: auto;
}
```

#### Same-Origin Only

Cross-document transitions only work between pages on the same origin for security.

#### Named Elements Across Pages

**Page A:**
```css
.header-logo {
  view-transition-name: logo;
}

.page-title {
  view-transition-name: main-title;
}
```

**Page B:**
```css
.header-logo {
  view-transition-name: logo; /* Same name = morphs between pages */
}

.article-title {
  view-transition-name: main-title;
}
```

#### Customize Cross-Document Animations

```css
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: slide-out-left 0.3s ease-out;
}

::view-transition-new(root) {
  animation: slide-in-right 0.3s ease-in;
}

@keyframes slide-out-left {
  to {
    transform: translateX(-100%);
  }
}

@keyframes slide-in-right {
  from {
    transform: translateX(100%);
  }
}
```

### Advanced Patterns

#### Direction-Based Transitions

```javascript
document.addEventListener('click', (e) => {
  if (e.target.matches('a[href]')) {
    e.preventDefault();

    const direction = e.target.dataset.direction || 'forward';
    document.documentElement.dataset.direction = direction;

    document.startViewTransition(() => {
      window.location.href = e.target.href;
    });
  }
});
```

```css
/* Forward navigation */
[data-direction="forward"] ::view-transition-old(root) {
  animation: slide-out-left 0.3s;
}

[data-direction="forward"] ::view-transition-new(root) {
  animation: slide-in-right 0.3s;
}

/* Back navigation */
[data-direction="back"] ::view-transition-old(root) {
  animation: slide-out-right 0.3s;
}

[data-direction="back"] ::view-transition-new(root) {
  animation: slide-in-left 0.3s;
}
```

#### Skip Transitions Conditionally

```javascript
function navigate(url, shouldTransition = true) {
  if (!shouldTransition || !document.startViewTransition) {
    window.location.href = url;
    return;
  }

  document.startViewTransition(() => {
    window.location.href = url;
  });
}
```

### Accessibility

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation: none !important;
  }
}
```

### Resources

- **Chrome Guide:** https://developer.chrome.com/docs/web-platform/view-transitions
- **web.dev Tutorial:** https://web.dev/learn/css/view-transitions-spas
- **MDN:** https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API

---

## Trigonometric Functions

### Overview

CSS trigonometric functions (`sin()`, `cos()`, `tan()`, `asin()`, `acos()`, `atan()`, `atan2()`) enable mathematical calculations directly in CSS, perfect for circular layouts, animations, and complex shapes.

### Browser Support (2025)

**Fully supported:** Chrome 111+, Edge 111+, Firefox 108+, Safari 15.4+
**Baseline:** Widely available since March 2024

All functions work across all modern browsers.

### Available Functions

- `sin()` - Sine
- `cos()` - Cosine
- `tan()` - Tangent
- `asin()` - Arc sine (inverse)
- `acos()` - Arc cosine (inverse)
- `atan()` - Arc tangent (inverse)
- `atan2()` - Two-argument arc tangent

### Angle Units

Functions accept angles in multiple units:

```css
sin(45deg)
sin(0.125turn)
sin(50grad)
sin(0.785398rad)  /* π/4 radians */
```

### Practical Use Cases

#### Circular Positioning

```css
:root {
  --radius: 200px;
  --item-count: 8;
}

.circle-item {
  --angle: calc(360deg / var(--item-count) * var(--index));

  position: absolute;

  /* X position */
  left: calc(
    50% + cos(var(--angle)) * var(--radius)
  );

  /* Y position */
  top: calc(
    50% + sin(var(--angle)) * var(--radius)
  );

  transform: translate(-50%, -50%);
}

/* Usage in HTML: style="--index: 0" through style="--index: 7" */
```

#### Animated Circular Menu

```css
@property --rotation {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.menu-container {
  --rotation: 0deg;
  transition: --rotation 0.5s ease-out;
}

.menu-container:hover {
  --rotation: 360deg;
}

.menu-item {
  --base-angle: calc(360deg / var(--items) * var(--index));
  --angle: calc(var(--base-angle) + var(--rotation));

  left: calc(50% + cos(var(--angle)) * var(--radius));
  top: calc(50% + sin(var(--angle)) * var(--radius));
}
```

#### Wave Animation

```css
.wave-item {
  --index: 1;
  animation: wave 2s ease-in-out infinite;
  animation-delay: calc(var(--index) * 0.1s);
}

@keyframes wave {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(
      calc(sin(calc(var(--index) * 30deg)) * 30px)
    );
  }
}
```

#### Polygon Shapes

```css
/* Pentagon using clip-path */
.pentagon {
  --size: 200px;
  width: var(--size);
  height: var(--size);

  clip-path: polygon(
    calc(50% + 50% * cos(0deg))
    calc(50% + 50% * sin(0deg)),

    calc(50% + 50% * cos(72deg))
    calc(50% + 50% * sin(72deg)),

    calc(50% + 50% * cos(144deg))
    calc(50% + 50% * sin(144deg)),

    calc(50% + 50% * cos(216deg))
    calc(50% + 50% * sin(216deg)),

    calc(50% + 50% * cos(288deg))
    calc(50% + 50% * sin(288deg))
  );
}
```

#### Responsive Rotation

```css
.rotated-element {
  /* Rotate based on container width */
  transform: rotate(
    calc(tan(1rad) * 1deg * var(--container-width))
  );
}
```

#### Sine Wave Border

```css
.sine-border {
  --amplitude: 20px;
  --frequency: 4;

  position: relative;
}

.sine-border::before {
  content: "";
  position: absolute;
  inset: 0;

  /* Create wave using multiple gradients */
  background: repeating-linear-gradient(
    90deg,
    transparent 0px,
    transparent calc(100% / var(--frequency)),
    blue calc(100% / var(--frequency)),
    blue calc(100% / var(--frequency) * 2)
  );

  /* Distort with clip-path */
  clip-path: polygon(
    /* Generate points using sin() */
  );
}
```

---

## @property - Typed Custom Properties

### Overview

`@property` enables defining CSS custom properties with types, initial values, and inheritance behavior, unlocking animated gradients, type-safe values, and enhanced developer experience.

### Browser Support (2025)

**Fully supported:** Chrome 85+, Edge 85+, Firefox 128+, Safari 16.4+
**Baseline:** Widely available since July 2024 (Firefox support completed)

### Basic Syntax

```css
@property --my-color {
  syntax: '<color>';
  inherits: false;
  initial-value: hotpink;
}

@property --spacing {
  syntax: '<length>';
  inherits: true;
  initial-value: 1rem;
}
```

### Available Syntax Types

**Lengths & Numbers:**
- `<length>` - CSS lengths (px, rem, em, etc.)
- `<number>` - Numeric values
- `<percentage>` - Percentage values
- `<length-percentage>` - Length or percentage
- `<integer>` - Whole numbers

**Colors:**
- `<color>` - Any color value

**Angles & Time:**
- `<angle>` - Angle values (deg, rad, turn)
- `<time>` - Time values (s, ms)
- `<resolution>` - Resolution (dpi, dpcm)

**Images:**
- `<image>` - Images and gradients
- `<url>` - URL values

**Transforms:**
- `<transform-function>` - Transform functions
- `<transform-list>` - List of transforms

**Identifiers:**
- `<custom-ident>` - Custom identifier
- `*` - Any value (untyped)

**Combinations:**
```css
@property --multi-value {
  syntax: '<color> | <length>';  /* OR */
  inherits: false;
  initial-value: red;
}
```

### Practical Use Cases

#### Animated Gradients

```css
@property --gradient-angle {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.gradient-box {
  --gradient-angle: 0deg;
  background: linear-gradient(
    var(--gradient-angle),
    red,
    blue
  );
  transition: --gradient-angle 1s ease-in-out;
}

.gradient-box:hover {
  --gradient-angle: 180deg;
}
```

#### Animated Gradient Colors

```css
@property --color-stop-1 {
  syntax: '<color>';
  inherits: false;
  initial-value: red;
}

@property --color-stop-2 {
  syntax: '<color>';
  inherits: false;
  initial-value: blue;
}

.animated-gradient {
  background: linear-gradient(
    90deg,
    var(--color-stop-1),
    var(--color-stop-2)
  );
  transition:
    --color-stop-1 0.5s,
    --color-stop-2 0.5s;
}

.animated-gradient:hover {
  --color-stop-1: purple;
  --color-stop-2: pink;
}
```

#### Rotating Icon

```css
@property --icon-rotation {
  syntax: '<angle>';
  inherits: false;
  initial-value: 0deg;
}

.icon {
  --icon-rotation: 0deg;
  transform: rotate(var(--icon-rotation));
  transition: --icon-rotation 0.3s;
}

.button:hover .icon {
  --icon-rotation: 360deg;
}
```

#### Animating Numbers (Counters)

```css
@property --count {
  syntax: '<integer>';
  inherits: false;
  initial-value: 0;
}

.counter {
  --count: 0;
  counter-reset: num var(--count);
  transition: --count 2s;
}

.counter::after {
  content: counter(num);
}

.counter.active {
  --count: 100;
}
```

#### Theme Color Transitions

```css
@property --theme-hue {
  syntax: '<number>';
  inherits: true;
  initial-value: 200;
}

:root {
  --theme-hue: 200;
  --primary: hsl(var(--theme-hue), 70%, 50%);
  --secondary: hsl(calc(var(--theme-hue) + 180), 70%, 50%);

  transition: --theme-hue 0.5s;
}

:root[data-theme="warm"] {
  --theme-hue: 30;
}

:root[data-theme="cool"] {
  --theme-hue: 240;
}
```

#### Spacing System with Types

```css
@property --spacing-unit {
  syntax: '<length>';
  inherits: true;
  initial-value: 0.5rem;
}

:root {
  --spacing-unit: 0.5rem;
  --space-xs: calc(var(--spacing-unit) * 1);
  --space-s: calc(var(--spacing-unit) * 2);
  --space-m: calc(var(--spacing-unit) * 4);
  --space-l: calc(var(--spacing-unit) * 8);
}

@media (min-width: 768px) {
  :root {
    --spacing-unit: 0.625rem;
  }
}
```

#### Animation with Custom Properties

```css
@property --progress {
  syntax: '<percentage>';
  inherits: false;
  initial-value: 0%;
}

.progress-bar {
  --progress: 0%;

  &::before {
    content: "";
    display: block;
    width: var(--progress);
    height: 100%;
    background: blue;
    transition: --progress 1s ease-out;
  }
}

.progress-bar.complete {
  --progress: 100%;
}

@keyframes loading {
  from { --progress: 0%; }
  to { --progress: 100%; }
}

.loading {
  animation: loading 2s linear infinite;
}
```

### JavaScript Integration

```javascript
// Register @property in JavaScript
CSS.registerProperty({
  name: '--my-color',
  syntax: '<color>',
  inherits: false,
  initialValue: 'red',
});

// Set value
element.style.setProperty('--my-color', 'blue');

// Animate programmatically
element.animate(
  {
    '--my-color': ['red', 'blue'],
  },
  {
    duration: 1000,
    easing: 'ease-in-out',
  }
);
```

### Benefits

1. **Type Safety** - Prevents invalid values
2. **Animatable** - Enables smooth transitions previously impossible
3. **Initial Values** - Guaranteed fallback
4. **Better Debugging** - DevTools show types and validation errors
5. **Inheritance Control** - Explicit inheritance behavior

---

## Browser Support Summary

### Feature Support Matrix (January 2025)

| Feature | Chrome | Edge | Firefox | Safari | Baseline |
|---------|--------|------|---------|--------|----------|
| **Container Queries** | 105+ | 105+ | 110+ | 16+ | ✅ Feb 2023 |
| **Subgrid** | 118+ | 118+ | 71+ | 16+ | ✅ Sep 2023 |
| **:has()** | 106+ | 105+ | 122+ | 15.5+ | ✅ Dec 2023 |
| **@layer** | 99+ | 99+ | 97+ | 15.4+ | ✅ Mar 2022 |
| **CSS Nesting** | 112+ | 112+ | 117+ | 16.5+ | ✅ Aug 2023 |
| **color-mix()** | 111+ | 111+ | 113+ | 16.4+ | ✅ Mar 2024 |
| **oklch()** | 111+ | 111+ | 113+ | 16.4+ | ✅ Mar 2024 |
| **Scroll Animations** | 115+ | 115+ | 🚧 | 26 beta | ⏳ Soon |
| **Anchor Positioning** | 125+ | 125+ | ❌ | 🚧 | ⏳ Soon |
| **View Transitions** | 111+ | 111+ | 144 beta | 18+ | ⏳ Soon |
| **Trig Functions** | 111+ | 111+ | 108+ | 15.4+ | ✅ Mar 2024 |
| **@property** | 85+ | 85+ | 128+ | 16.4+ | ✅ Jul 2024 |

**Legend:**
- ✅ Baseline (widely available)
- ⏳ Soon (partial support, becoming baseline)
- 🚧 In Development
- ❌ Not Supported

### Progressive Enhancement Strategy

```css
/* Layer 1: Baseline support (works everywhere) */
.component {
  display: block;
  padding: 1rem;
}

/* Layer 2: Widely available (Baseline features) */
@supports (container-type: inline-size) {
  .component {
    container: component / inline-size;
  }

  @container (inline-size > 400px) {
    .component {
      display: grid;
      grid-template-columns: 1fr 1fr;
    }
  }
}

/* Layer 3: Cutting edge (progressive enhancement) */
@supports (anchor-name: --test) {
  .tooltip {
    position: absolute;
    position-anchor: --button;
    position-area: top;
  }
}
```

---

## Resources & References

### Official Documentation

**MDN Web Docs:**
- Container Queries: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries
- Subgrid: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid
- :has(): https://developer.mozilla.org/en-US/docs/Web/CSS/:has
- @layer: https://developer.mozilla.org/en-US/docs/Web/CSS/@layer
- View Transitions: https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API

**Chrome for Developers:**
- CSS Container Queries: https://developer.chrome.com/blog/cq-polyfill
- Scroll-Driven Animations: https://developer.chrome.com/docs/css-ui/scroll-driven-animations
- Anchor Positioning: https://developer.chrome.com/blog/anchor-positioning-api
- View Transitions: https://developer.chrome.com/docs/web-platform/view-transitions

**WebKit (Safari):**
- :has() Selector: https://webkit.org/blog/13096/css-has-pseudo-class/
- Scroll-Driven Animations: https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/
- Anchor Positioning: https://webkit.org/blog/17240/a-gentle-introduction-to-anchor-positioning/

**web.dev:**
- CSS Trig Functions: https://web.dev/articles/css-trig-functions
- Subgrid: https://web.dev/articles/css-subgrid
- View Transitions (SPAs): https://web.dev/learn/css/view-transitions-spas
- @property: https://web.dev/blog/at-property-baseline

### CSS-Tricks Guides

- Cascade Layers: https://css-tricks.com/css-cascade-layers/
- :has() Selector: https://css-tricks.com/the-css-has-selector/
- color-mix(): https://css-tricks.com/almanac/functions/c/color-mix/
- Scroll-Driven Animations: https://css-tricks.com/unleash-the-power-of-scroll-driven-animations/

### Utopia.fyi

- Homepage: https://utopia.fyi/
- Type Calculator: https://utopia.fyi/type/calculator/
- Space Calculator: https://utopia.fyi/space/calculator/
- Blog: https://utopia.fyi/blog/
- Smashing Magazine Article: https://www.smashingmagazine.com/2021/04/designing-developing-fluid-type-space-scales/

### Can I Use

Check latest browser support:
- https://caniuse.com/css-container-queries
- https://caniuse.com/css-subgrid
- https://caniuse.com/css-has
- https://caniuse.com/css-nesting

### Interactive Demos

- Scroll-Driven Animations: https://scroll-driven-animations.style/
- Container Queries Demos: Various CodePen collections
- Anchor Positioning Examples: Chrome Developer demos

### Community Resources

**Smashing Magazine:**
- Container Queries Primer: https://www.smashingmagazine.com/2021/05/complete-guide-css-container-queries/
- Cascade Layers: https://www.smashingmagazine.com/2022/01/introduction-css-cascade-layers/
- Scroll-Driven Animations: https://www.smashingmagazine.com/2024/12/introduction-css-scroll-driven-animations/

**Articles & Tutorials:**
- Ahmad Shadeed (CSS expert): https://ishadeed.com/
- CSS { In Real Life }: https://css-irl.info/
- Codrops: https://tympanus.net/codrops/

---

## Conclusion

The CSS landscape in 2025 offers unprecedented power for creating responsive, performant, and maintainable designs. Key takeaways:

**🎯 Production-Ready (Use Now):**
- Container Queries for component-level responsiveness
- Subgrid for aligned nested layouts
- :has() for parent/conditional selection
- @layer for specificity management
- Native CSS Nesting for cleaner code
- color-mix() and oklch() for better colors
- @property for typed custom properties
- Trig functions for mathematical layouts

**🚀 Emerging (Progressive Enhancement):**
- Scroll-Driven Animations for scroll effects
- View Transitions for smooth page changes
- Anchor Positioning for tooltips/popovers

**💡 Best Practices:**
1. Combine Grid + Flexbox (Grid for 2D, Flex for 1D)
2. Use Utopia.fyi for fluid, systematic scaling
3. Container Queries for components, Media Queries for preferences
4. @layer for architecture, :has() for relationships
5. Progressive enhancement for cutting-edge features
6. Test across browsers with @supports

**🔮 The Future:**
CSS continues evolving toward more powerful, declarative, and performant capabilities. With these modern features, we can build sophisticated interfaces with less JavaScript, better performance, and clearer intent.

---

*Last Updated: January 16, 2025*
*Next Review: Q2 2025 (monitor Scroll Animations and Anchor Positioning baseline status)*
