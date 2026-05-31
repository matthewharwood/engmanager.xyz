Every blog I have ever loved had merch.

CSS-Tricks. The Rust ones. The little indie design journals that taught me more than school did. The good ones always had a store — and I never bought any of it.

Not because I didn't want to support them. Because the merch never matched the work. The writing would be meticulous, the demos pixel-perfect, every gradient agonized over — and then the store was a default Shopify theme with a heather-grey tee and a logo slapped on the chest. The care stopped right at the storefront.

So I had a dumb question. Could *I* make merch that felt as considered as the thing it was selling? And — funnier question — could I actually get a stranger to buy it?

<aside class="article-callout">
  <strong>The experiment:</strong>
  vibe-code a real store — real checkout, real product, real polish — as one person with AI, and find out if a single embroidered dad cap actually sells.
</aside>

Funny enough: while I was building this, I went to pull up the CSS-Tricks store for old times' sake. They took it down. The canonical blog-with-merch doesn't have merch anymore.

Perfect. The lane is open.

<p class="shop-cta-inline">
  Want to skip the story and just see the thing?
  <a class="shop-cta-inline-link" href="https://shop.engmanager.xyz">shop.engmanager.xyz <span aria-hidden="true">→</span></a>
</p>

## Why a Store Is the Right Brick

This isn't a random side quest. It's the cheapest possible test of an idea I actually care about.

[Project FootTraffic](/articles/project-foottraffic) is the bigger swing: treat overlooked local plazas like real estate, raise the value of the place, and fund a compounding product platform one small business at a time. Booking flows. Quoting. A point-of-sale extension. A checkout a nail salon would never be priced into otherwise.

The whole thesis leans on a question I had never honestly stress-tested: **can one person, with AI, stand up a genuinely good store — design, product, payments, the works — at a low enough effort that it's worth doing for a business that small?**

A merch store for my own blog is the lowest-stakes way to find out. Low barrier to entry. Nobody's livelihood on the line. If I can sell a dad cap that says `SCRUM MASTER` to someone on the internet, then the checkout and POS modules FootTraffic needs stop being theoretical and start being a thing I have shipped.

Also it's just funny. Both things are allowed to be true.

## The Bar: Yeezy

I took the UI almost entirely from Yeezy.

YZY SPLY — conceived by Kanye West, designed by Nick Knight — is the most reductive storefront in fashion. The brief was, roughly, *make it beautiful in its simplicity*: no words where words weren't needed, nothing trapped inside boxes, everything as large as it could be, the product allowed to be the entire interface. Earlier versions leaned on the lo-fi aesthetic of sites that sell medical supplies and camping gear — almost defiantly plain — and let the goods carry the page.

I'm not selling three-hundred-dollar foam shoes. I'm selling dad caps with engineering-manager in-jokes embroidered on the front. But the *posture* is the same: strip the chrome, set the type big and uppercase, and let the cap be the whole experience. No mega-nav. No carousel of trust badges. No cookie wall fistfight. A grid of caps, and then one cap.

That restraint is a feature, not laziness. Every element I *didn't* add is a thing that can't get in the way of the product.

## The Whole Thing Is a Rust Macro

There is no React here. No SPA, no hydration, no client framework tax.

The entire store is server-rendered HTML strings, produced by a JSX-like templating macro I have been chipping away at in Rust. I wrote up [step one of that experiment](/articles/jsx-like-rust-macro) a while back — a tiny `htm!` macro built with `macro_rules!`. It has since grown teeth: a `view!` macro that reads like JSX (`{ expr }` to splice, `"text"` for text nodes, real components as plain functions) and compiles straight down to a `String`.

Axum serves that string. Assets are embedded into the binary at compile time, minified (lightningcss for CSS, oxc for JS), and given content-hashed URLs. The whole shop ships as **one Rust binary** — no node_modules, no build server, no runtime framework to babysit.

The trade I like: I get the developer experience of JSX and the output of a static string. The HTML is just there on first paint. The thing that makes it feel modern isn't a framework — it's the macro and the animation work sitting on top of plain, fast, boring HTML.

## Checkout That Never Leaves

The one rule I refused to break: **never take you off the site.**

So many small stores hand you a beautiful experience and then yeet you to a hosted checkout page on a different domain with different fonts. The spell breaks. I wanted the buy to feel like part of the same room.

That meant inline Stripe Elements, mounted right inside the bag's own pane — not a redirect. Add a cap, the bag slides over, and the payment + address fields are *there*, themed to match whatever color theme you've picked (there's a little bridge that resolves the site's oklch design tokens into a Stripe Appearance object so the inputs match the rest of the UI). A deferred PaymentIntent keeps the flow snappy; the cart is **always priced on the server**, because you never trust a price the browser hands you; and the only time you'd ever leave the page is a 3-D Secure challenge, which is the bank's call, not mine.

<div class="workflow">
  <div class="workflow-stage workflow-stage-single">Grid</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Product</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Bag</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Pay</div>
</div>

Keeping it inline is the kind of detail nobody consciously notices and everybody feels. That's the bar I'm trying to hold the whole way through.

I've been talking around it for half an article. Let me just put it here, loud:

<div class="shop-breakout">
  <div class="shop-breakout-inner">
    <p class="shop-breakout-kicker">The merch experiment, live</p>
    <p class="shop-breakout-headline">Go get a cap</p>
    <a class="shop-breakout-button" href="https://shop.engmanager.xyz">
      <span>shop.engmanager.xyz</span>
      <span aria-hidden="true">→</span>
    </a>
  </div>
</div>

## The Part I'm Proud Of: A Camera That Zooms Into the Grid

Tap a cap in the grid and the grid appears to *zoom* — like a camera dollying in — until that one cap fills the screen as the product view. Tap back and it pulls out. It feels physical, like the product was always there and you just moved toward it.

The naive way to build that is to animate the real grid. Don't. The grid is a lot of real DOM, and transforming it means the browser is doing layout and paint work on every frame — which is exactly where cheap phones fall apart.

Here's the trick instead: **I never animate the real grid at all.**

<figure class="article-figure shop-camera-figure" aria-labelledby="camera-fig-title">
  <svg viewBox="0 0 860 360" role="img" aria-labelledby="camera-fig-title camera-fig-desc" style="width:100%;height:auto;color:inherit">
    <title id="camera-fig-title">Grid to focused product: a layered camera zoom</title>
    <desc id="camera-fig-desc">A snapshot of the visible grid is cloned into an off-screen "world" with a focus layer and a background layer. A single translate3d and scale transform zooms the world so the tapped cap fills the screen; the background fades out, the focus cap stays sharp, and the real grid stays hidden and never repaints.</desc>
    <!-- Panel A: the grid -->
    <rect x="36" y="40" width="200" height="200" rx="12" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.85"/>
    <g stroke="currentColor" stroke-width="1.4" fill="none" opacity="0.45">
      <rect x="56" y="60" width="48" height="48" rx="6"/>
      <rect x="112" y="60" width="48" height="48" rx="6"/>
      <rect x="168" y="60" width="48" height="48" rx="6"/>
      <rect x="56" y="116" width="48" height="48" rx="6"/>
      <rect x="168" y="116" width="48" height="48" rx="6"/>
      <rect x="56" y="172" width="48" height="48" rx="6"/>
      <rect x="112" y="172" width="48" height="48" rx="6"/>
      <rect x="168" y="172" width="48" height="48" rx="6"/>
    </g>
    <!-- focus card -->
    <rect x="112" y="116" width="48" height="48" rx="6" fill="currentColor" fill-opacity="0.12" stroke="currentColor" stroke-width="2"/>
    <path d="M124 150 Q124 128 136 128 Q148 128 148 150 Z" fill="currentColor" fill-opacity="0.5"/>
    <path d="M120 150 Q136 158 152 150 Q136 154 120 150 Z" fill="currentColor" fill-opacity="0.5"/>
    <text x="136" y="262" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1.5" fill="currentColor">GRID</text>
    <!-- frustum: the highlighted card expands into the product panel -->
    <g stroke="currentColor" stroke-width="1.2" stroke-dasharray="5 5" opacity="0.7">
      <line x1="160" y1="116" x2="612" y2="44"/>
      <line x1="160" y1="164" x2="612" y2="236"/>
    </g>
    <text x="388" y="128" text-anchor="middle" font-size="12" letter-spacing="0.5" fill="currentColor" opacity="0.8">camera =</text>
    <text x="388" y="146" text-anchor="middle" font-size="12" letter-spacing="0.5" fill="currentColor" opacity="0.8">translate3d + scale</text>
    <text x="388" y="178" text-anchor="middle" font-size="11" letter-spacing="0.5" fill="currentColor" opacity="0.55">(one GPU transform)</text>
    <!-- Panel B: focused product -->
    <rect x="612" y="40" width="200" height="200" rx="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
    <path d="M666 170 Q666 104 720 104 Q774 104 774 170 Z" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
    <path d="M656 170 Q720 196 784 170 Q720 182 656 170 Z" fill="currentColor" fill-opacity="0.14" stroke="currentColor" stroke-width="2"/>
    <circle cx="720" cy="104" r="4.5" fill="currentColor"/>
    <text x="712" y="262" text-anchor="middle" font-size="13" font-weight="700" letter-spacing="1.5" fill="currentColor">FOCUSED PRODUCT</text>
    <!-- legend: the layers -->
    <g font-size="12.5" letter-spacing="0.3">
      <rect x="40" y="296" width="16" height="16" rx="3" fill="currentColor" fill-opacity="0.85" stroke="currentColor" stroke-width="1.2"/>
      <text x="66" y="308" fill="currentColor">Focus layer — the tapped cap, stays sharp</text>
      <rect x="40" y="320" width="16" height="16" rx="3" fill="currentColor" fill-opacity="0.3" stroke="currentColor" stroke-width="1.2"/>
      <text x="66" y="332" fill="currentColor">Background layer — every other card, fades out</text>
      <rect x="478" y="296" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-dasharray="4 3"/>
      <text x="504" y="308" fill="currentColor">Real grid — hidden the whole time, never repaints</text>
      <rect x="478" y="320" width="16" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.2"/>
      <text x="504" y="332" fill="currentColor">Close camera — pre-built during idle, snaps back</text>
    </g>
  </svg>
  <figcaption>Tap a cap and a cloned snapshot of the grid zooms in. Only the lightweight clone moves; the real grid sits still.</figcaption>
</figure>

When you tap, I clone a snapshot of the visible cards into an off-screen "world" and split it into two layers: a **focus layer** holding just the tapped cap, and a **background layer** holding everyone else (off-screen cards are culled — no point cloning what you can't see). Then a single `translate3d(...) scale(...)` on the world zooms it so the tapped card's rectangle lands exactly on the product image's final rectangle — a FLIP-style match. The GPU composites that one transform; nothing in the document reflows.

As the world zooms, the background layer fades out, the focus cap stays crisp on its own layer, and the real product panel fades in right as the zoom lands. The real grid stays hidden behind all of it the entire time, so it never paints during the animation. The reverse — the close — is pre-built during idle time, so backing out snaps instantly instead of stuttering.

Layers are the whole game. Separating the subject from the background lets each one move and fade on its own cheap timeline, and cloning lets the expensive, real DOM sit perfectly still while a throwaway copy does the theatrics. It's the same instinct as a film camera: the actor and the backdrop are different planes, and the camera moves through both.

## Is It Vibe-Coded? Obviously.

Yes. Completely. I built most of this by talking to Claude Code, not typing — which is its own [whole story](/articles/talking-not-typing).

I'm not hiding that, and I'd argue it's part of the allure. The point was never "I hand-crafted every line of this by candlelight." The point is that one person can now ship something that *looks* hand-crafted — the camera zoom, the inline checkout, the theme-matched Stripe inputs — in the time it used to take to argue about a CSS reset. The floor is rising. A blog's merch store has no excuse to feel cheap anymore, because the effort it takes to make it feel expensive has collapsed.

Is every line how I'd have written it by hand? No. Does the cap arrive embroidered and real? Also yes. That gap — between "vibe-coded" and "actually works and actually ships a physical object to your door" — is exactly the thing I wanted to measure.

## Now the Real Test

The store is live: a grid of eighteen embroidered dad caps, each one an engineering-manager bit — `SCRUM MASTER`, `VELOCITY`, `LGTM +2` — for about the price of a nice lunch. Tap one, watch the camera zoom, check out without ever leaving the page.

The honest experiment is whether anyone buys one. I genuinely don't know yet, and that's the fun part.

<aside class="shop-cta-card">
  <p class="shop-cta-card-kicker">Eighteen caps · checkout never leaves the page</p>
  <a class="shop-cta-card-button" href="https://shop.engmanager.xyz">Browse the caps <span aria-hidden="true">→</span></a>
</aside>

<aside class="article-callout">
  <strong>This is where you come in.</strong>
  Drop a comment on this thread with merch ideas. The dumber and sharper the inside joke, the better — sprint-retro trauma, on-call gallows humor, the phrase your worst manager overused. If your idea ends up on a cap, I'll make sure you know.
</aside>

Help me find out if I can actually sell this thing. Brick by brick.
