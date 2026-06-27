It started, like most of our good ideas, in a Slack thread at lunch.

Daksh confirmed we still had the Stripe integration wired up — an ecommerce template where you swap in your own keys and it just works, with an API that sends every order upstream into our CMS admin panel so the shop can either pipe it to a shipping service or just see who bought what. So I did the thing I always do. I went looking for someone to sell it to.

I found [Rune and Board](https://runeandboard.com) — a family-friendly game shop out in Hillsboro. The name is a play on "Room and Board," which I love. The site is rough. But it's already doing a *ton* under the hood — real inventory, real commerce, the works; it just looks like it was assembled between shifts. I looked at it and thought, I can make these people something badass.

That's the entire FootTraffic instinct in one browser tab. [Project FootTraffic](/articles/project-foottraffic) is the bigger swing — treat overlooked local plazas like real estate, raise the value of the place, and fund a compounding platform one small business at a time. Chris asked the right question in the thread: these shops reach for free stuff like WordPress, so will they actually pay us? Yes. They pull roughly five grand a day through the register. They have the money. What they don't have is a dev.

Which is exactly the opening. But this post isn't the pitch for FootTraffic — that one's already written. This is the pitch for the thing that sits *on top* of it, and I want the eng team to build it.

<aside class="article-callout">
  <strong>The pitch:</strong> once we own a portfolio of small businesses, their recurring work stops being a services backlog and becomes a standing inventory of demand — a three-sided marketplace that clears like an order book.
</aside>

## The Thread Was the Whole Strategy

Re-read what the team said in twenty minutes. Daksh: one person can maintain five or six websites — point an MCP at the CMS and mass-create the blocks. Chris: small businesses don't have devs, so the subscription has to include a dev who builds the template and the first wave of content; after that, updates are a piece of cake. And Chris reached for a word he and edibles had already been kicking around — *skills*. Named, reusable procedures that make the AI faster and less likely to misshape a build.

Nobody in that thread was describing a website. They were describing an assembly line. And an assembly line with idle capacity is just a market nobody has opened yet.

## A Standing Inventory of Demand

Here's the part most agencies never get to stand on.

Once we own a portfolio of these businesses across Portland, LA, Austin, Detroit — dozens today, hundreds as we grow — every one of them is a faucet of recurring work. A booking flow that needs wiring. A menu redesign. "Can someone fix our Google listing this week." A new-release Friday that really should have been a pre-order drop.

Each of those is a unit of work attached to a real business that already trusts us and already pays. That's not a backlog. That's demand we already own — and demand you already own is the single hardest thing for any marketplace to manufacture.

It's a marketplace waiting to clear.

## Three Sides, One Board

The model I keep drawing on the whiteboard looks like [rentahuman.ai](https://rentahuman.ai) — but pointed inward, at our own real estate. Three sides.

**Side one — the businesses.** We build the most ergonomic tooling we possibly can so an owner can self-serve the easy stuff: the booking widget, the loyalty loop, the post-visit text, the discount code and gift card Daksh would otherwise have to go figure out by hand. Push-button. No human required.

**Side two — the open network.** When an owner hits something they don't want to touch, they don't file a ticket and wait on an account manager. They *vibe-submit* it in plain English, it drops onto a board, and it's first come, first serve. Any operator — or AI-assisted human — in the network can claim it and ship it.

**Side three — us, the house.** This is the part that makes it ours and not just another freelancer site. We're not neutral plumbing sitting between a buyer and a freelancer. We're a participant on our own board. We claim the brand-defining, high-margin work ourselves, we set the quality floor the whole network has to clear, and we capture every reusable module that falls out of a job — which feeds straight back into the FootTraffic platform layer.

<figure class="model-figure" aria-label="The three-sided marketplace">
<div class="mermaid">
flowchart TD
  O["Business owner"]
  O -->|"easy stuff"| TOOLS["Self-serve tools (push-button)"]
  O -->|"vibe-submit, plain English"| BOARD{{"The Board — order book"}}
  BOARD -->|"claim, first come first serve"| NET["Open operator network"]
  BOARD -->|"brand-defining, high-margin"| HOUSE["The House — us"]
  TOOLS --> DONE["Shipped back to the owner"]
  NET --> DONE
  HOUSE --> MOD["Reusable module"]
  MOD --> DONE
</div>
<figcaption>The businesses are the buyers. The open network is supply. We're the house — running the order book and trading on it at the same time.</figcaption>
</figure>

## What the Owner Touches

For the owner, none of that machinery should show. They get a console. The easy things are buttons. The hard things are a text box.

<div class="wireframe" role="img" aria-label="Wireframe of the owner console: push-button tools and a vibe-submit text box">
<div class="wireframe-chrome"><span class="wf-dot"></span><span class="wf-dot"></span><span class="wf-dot"></span><span class="wf-chrome-url">runeandboard.com · owner console</span></div>
<div class="wireframe-screen">
<p class="wf-label">Push-button</p>
<div class="wf-tools"><span class="wf-tool">Booking</span><span class="wf-tool">Loyalty loop</span><span class="wf-tool">Post-visit text</span><span class="wf-tool">Discounts &amp; gift cards</span></div>
<p class="wf-label">Need something built?</p>
<div class="wf-compose"><div class="wf-compose-input">Make my new-release Friday a pre-order drop with a $5 deposit and a text when stock lands…</div><div class="wf-compose-foot"><span class="wf-note">first come, first serve</span><span class="wf-btn">Post to board →</span></div></div>
</div>
</div>

That text box is the whole UX bet. The owner shouldn't have to know whether "pre-order Friday" is a tool toggle, a template tweak, or a two-day build. They describe the outcome they want; the system figures out who clears it.

## The Board

Behind the text box is the board. This is where supply meets demand.

<div class="wireframe" role="img" aria-label="Wireframe of the open job board with first-come-first-serve claim rows">
<div class="wireframe-chrome"><span class="wf-dot"></span><span class="wf-dot"></span><span class="wf-dot"></span><span class="wf-chrome-url">rentahuman.ai · open board</span></div>
<div class="wireframe-screen wf-feed">
<div class="wf-job"><span class="wf-job-status is-open">OPEN</span><span class="wf-job-main"><span class="wf-job-title">Pre-order drop for new-release Friday</span><span class="wf-job-meta"><span class="wf-chip wf-chip-biz">Rune &amp; Board</span><span class="wf-chip wf-chip-tag">storefront</span><span class="wf-chip wf-chip-sla">due Fri</span></span></span><span class="wf-claim">Claim</span></div>
<div class="wf-job"><span class="wf-job-status is-open">OPEN</span><span class="wf-job-main"><span class="wf-job-title">Fix Google Business listing + hours</span><span class="wf-job-meta"><span class="wf-chip wf-chip-biz">Pearl Nail Bar</span><span class="wf-chip wf-chip-tag">local-seo</span><span class="wf-chip wf-chip-sla">this week</span></span></span><span class="wf-claim">Claim</span></div>
<div class="wf-job"><span class="wf-job-status is-claimed">CLAIMED</span><span class="wf-job-main"><span class="wf-job-title">Menu redesign + photo intake</span><span class="wf-job-meta"><span class="wf-chip wf-chip-biz">Cafe Oso</span><span class="wf-chip wf-chip-tag">content</span></span></span><span class="wf-claimed">@dak</span></div>
<div class="wf-job"><span class="wf-job-status is-house">HOUSE</span><span class="wf-job-main"><span class="wf-job-title">New brand system + POS extension</span><span class="wf-job-meta"><span class="wf-chip wf-chip-biz">Rune &amp; Board</span><span class="wf-chip wf-chip-tag">brand</span><span class="wf-chip wf-chip-tag">module</span></span></span><span class="wf-claimed">The House</span></div>
</div>
</div>

First come, first serve, with a lock so two operators never grab the same job. A business chip so whoever claims it has the context. A tag for the kind of work. An SLA so "this week" actually means something. And the house, sitting quietly in the same feed, claiming the jobs worth doing ourselves.

## Routing Is the Whole Game

Everything I just showed you is window dressing on one hard problem: when a request comes in, where does it go? That decision — tool, open network, or house — is the core IP. Get it right and one person really can run a territory of a hundred businesses. Get it wrong and we're a worse agency with extra steps.

<figure class="model-figure" aria-label="How a request gets routed">
<div class="mermaid">
flowchart TD
  REQ["vibe-submit request"] --> PARSE["Intake parser: text to structured job"]
  PARSE --> Q{"Can a tool do it?"}
  Q -->|"yes"| AUTO["Self-serve tool auto-resolves"]
  Q -->|"no, commodity"| OPEN["Post to open board, first come first serve"]
  Q -->|"no, brand-defining"| HOUSE["Route to the House"]
  HOUSE --> CAP["Capture reusable module"]
  AUTO --> DONE["Shipped"]
  OPEN --> DONE
  CAP --> DONE
</div>
<figcaption>The router is the asset. The intake parser turns plain English into a structured job; the classifier decides who clears it.</figcaption>
</figure>

The classifier asks three things in order. Can a tool already do this? Is it commodity work the network should clear? Or is it brand-defining enough that the house should take it and turn it into a module the next hundred shops inherit? That router is the thing I most want us to get obsessive about.

## Why We're the House — and Why It Compounds

Trading on our own board is what turns regional ownership into a liquidity engine.

Every job the house claims should leave the company more capable than it was before. The discount-code flow Daksh has to figure out once becomes a button every shop gets forever. The MCP-driven block creation and the skills Chris and edibles keep pushing for aren't side quests — they *are* the supply side's productivity, and ours. The better they get, the cheaper execution gets; the cheaper execution gets, the more businesses we can hold; the more businesses we hold, the deeper the board.

<figure class="model-figure" aria-label="The liquidity loop">
<div class="mermaid">
flowchart LR
  A["More businesses (FootTraffic real estate)"] --> B["More recurring demand"]
  B --> C["Deeper, busier board"]
  C --> D["More operators show up"]
  D --> E["More jobs, more captured modules"]
  E --> F["Cheaper, faster execution"]
  F --> A
</div>
<figcaption>The loop only spins because we own the real estate. The demand is already there.</figcaption>
</figure>

This is the Uber model fused to the agency model — which, after twenty years, is honestly all I've ever worked inside, so it's all I know how to build. I can't help myself but try to mimic it. The one difference that matters: we're not starting cold. We don't have to beg for either side. The real estate hands us the demand on day one, and [we've already proven one person plus AI can stand up a real store](/articles/vibe-coding-a-shop) on the supply side.

## What I Want Us to Build

So, team — here's the brick I'm asking us to lay next. Roughly in order:

<div class="workflow">
  <div class="workflow-stage workflow-stage-single">Intake parser</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">The board</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Router</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Module capture</div>
</div>

- **Intake parser** — vibe-submit text into a structured, routable job. This is where the magic has to feel like magic.
- **The board** — post, claim, lock, SLA, status. Boring, load-bearing, has to be bulletproof.
- **The router** — the classifier that sends a job to a tool, the network, or the house. The IP.
- **Self-serve tiles** — booking, loyalty, post-visit, discounts and gift cards. Chris, Daksh — this is the assembly line you two already sketched.
- **Module capture** — every house job ends by promoting its reusable part up into the platform.
- **Billing** — subscriptions on top of the Stripe wiring we already have. We don't beat Shopify's margin, and we're not trying to.

We have the CMS. We have Stripe. We have a game shop in Hillsboro that deserves better than what it's running. That's enough to lay the first brick.

<aside class="article-callout">
  <strong>Team, this is where you come in.</strong> Tell me which brick is wrong, which one's missing, and which one you want to own. Same as always — we build it brick by brick.
</aside>

<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.esm.min.mjs";

const root = document.documentElement;
const nodes = Array.from(document.querySelectorAll(".mermaid"));
// Stash each diagram's source so we can re-render cleanly on theme change.
nodes.forEach((el) => { el.dataset.src = el.textContent; });

const readVar = (name, fallback) =>
  getComputedStyle(root).getPropertyValue(name).trim() || fallback;

function themeVariables() {
  const accent = readVar("--accent", "#e64553");
  const text = readVar("--ctp-text", "#cdd6f4");
  const base = readVar("--ctp-base", "#1e1e2e");
  const surface = readVar("--ctp-surface0", "#313244");
  const mantle = readVar("--ctp-mantle", "#181825");
  const line = readVar("--ctp-overlay1", "#7f849c");
  const mono = readVar("--font-mono", "ui-monospace, monospace");
  return {
    background: base,
    primaryColor: surface,
    primaryTextColor: text,
    primaryBorderColor: accent,
    secondaryColor: mantle,
    secondaryTextColor: text,
    secondaryBorderColor: line,
    tertiaryColor: mantle,
    tertiaryTextColor: text,
    tertiaryBorderColor: line,
    lineColor: line,
    textColor: text,
    nodeBorder: accent,
    clusterBkg: mantle,
    fontFamily: mono,
    fontSize: "14px",
  };
}

async function render() {
  nodes.forEach((el) => {
    el.removeAttribute("data-processed");
    el.style.visibility = "";
    el.textContent = el.dataset.src;
  });
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    flowchart: { curve: "basis", useMaxWidth: true },
    themeVariables: themeVariables(),
  });
  try {
    await mermaid.run({ nodes });
  } catch (_) {
    // Render failed (parse error, or the CDN import never resolved). The CSS
    // hides un-processed .mermaid nodes to avoid a flash of source, so un-hide
    // any that didn't render — better the reader sees the source than an
    // empty box. (No-JS readers still get each diagram's <figcaption> prose.)
    nodes.forEach((el) => {
      if (!el.hasAttribute("data-processed")) el.style.visibility = "visible";
    });
  }
}

// Serialize renders. A rapid theme toggle must not start a second
// mermaid.run over the same nodes while the first is still in flight —
// mermaid isn't reentrant over a shared node set, so overlapping runs can
// throw or emit garbled SVG. Chaining guarantees one render at a time.
let chain = Promise.resolve();
const schedule = () => { chain = chain.then(render); };
schedule();
window.addEventListener("engmanager:themechange", schedule);
try {
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", schedule);
} catch (_) {}
</script>
