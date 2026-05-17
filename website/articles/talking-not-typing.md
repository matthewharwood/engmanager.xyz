This morning I walked my dog. By the time I got home, my Rust app had three new features. I did not open a laptop. I did not sit at a desk. I talked into my phone.

That is what this post is about.

<aside class="article-callout">
  <strong>Heads up:</strong> this article was built the same way I am about to describe. So was the website you are reading it on. I talked. Claude Code listened. A pull request appeared. I clicked merge. You are reading the result.
</aside>

## The Kit

I use three small tools. Stacked together, they change everything.

<div class="workflow">
  <div class="workflow-stage workflow-stage-single">Voice</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">SuperWhisper</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Claude Code</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Pull Request</div>
</div>

1. **SuperWhisper** turns my voice into clean text. It is faster than I can type.
2. **Claude Code** reads that text. It writes code. It opens branches. It opens pull requests.
3. **MCP servers** are tiny bridges. They let Claude reach into apps like Linear and Gmail. Say "make a ticket," and a real ticket gets made.

That is the whole kit. Nothing else.

## Example 1: This Website

Look at the bottom-right corner. That is my face. Click it. A small text card pops up.

You probably did not notice that the styles on this page never go stale on your phone anymore. You probably also did not see the live Discord widget over on the [Auteurs](/articles/auteurs) post.

I shipped all three of those things this week. By talking.

- [Content-hashed asset URLs](https://github.com/matthewharwood/engmanager.xyz/pull/2) — fixes a bug that left mobile readers seeing a broken page.
- [A nicer author byline](https://github.com/matthewharwood/engmanager.xyz/pull/3) — small touch. Looks more like a real magazine now.
- [A live Discord widget](https://github.com/matthewharwood/engmanager.xyz/pull/4) — polls the Discord API every minute. Renders a row of avatars and an online counter. Fully cached on the server.

Each one is a real change to a Rust codebase. I typed none of them.

## Example 2: A Game For My Son

His name is Dean. He is learning math. So I built him a game.

The stack is built for a kid using an iPad. **Local-first** means the game works without internet. It only talks to the cloud when it needs an update.

<figure class="tether-figure" aria-label="An iPad that runs offline, tethered to a GitHub cloud only when updating">
  <svg class="tether-svg" viewBox="0 0 260 120" role="img">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="22" y="22" width="68" height="86" rx="8"/>
      <rect x="30" y="30" width="52" height="64" rx="2" fill="var(--ctp-mantle)"/>
      <circle cx="56" cy="102" r="2.5" fill="currentColor"/>
      <path d="M170 56 q-6 -22 -28 -16 q-10 -14 -24 -2 q-18 4 -10 24 q-2 14 14 14 l62 0 q22 -2 14 -20 z"/>
      <text x="138" y="86" font-family="ui-monospace, monospace" font-size="11" fill="var(--ctp-subtext0)" stroke="none">GitHub</text>
    </g>
    <path d="M92 66 q22 -10 46 -4" fill="none" stroke="var(--ctp-overlay1)" stroke-width="2" stroke-dasharray="5 5">
      <animate attributeName="stroke-dashoffset" from="0" to="-10" dur="1.6s" repeatCount="indefinite"/>
    </path>
  </svg>
  <figcaption>The iPad only reaches out when there is a new update. The rest of the time the game is on its own.</figcaption>
</figure>

Why does that matter? Because Dean uses his iPad in the back of the car. Wifi is flaky. The game has to work anyway.

The fun trick: the code **heals itself**. If something breaks, the next prompt fixes it. I am not afraid of breaking things, because nothing stays broken for long.

I also use **Codex** to make the artwork. I asked it for bestiaries — the monster lineups from classic Final Fantasy games. It came back with creatures Dean had never seen anywhere else. He loves them.

> There is no perfect tech stack. This one fits its job: a learning game my son plays on an iPad, hosted free on GitHub, that I can ship to him every weekend.

## Example 3: Broadcast Software, From My Phone

There is a second project called **Screen**. It is broadcast software — the kind a streamer would use to go live. Real, sellable software, built on serious tech:

- **Rust** for the core (a fast, safe systems language)
- **GStreamer** for the video pipeline (the same engine some TV stations use)
- **Leptos** for the UI
- **Tauri** to wrap it as a desktop app

I have no business writing software like this. I am not the right kind of engineer. But I am doing it anyway.

Here is how. I am out walking the dog. I think of something. I open my phone. I talk into it. I paste the words into Claude Code. It makes Linear tickets. I write one more prompt: *work through these*. It chews through them while I keep walking. If it gets stuck, my phone dings. I answer. It keeps going.

<figure class="moonloop-figure" aria-label="Work happens overnight">
  <svg class="moonloop-svg" viewBox="0 0 120 80" role="img">
    <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 22 a18 18 0 1 0 0 36 a14 14 0 1 1 0 -36 z" fill="var(--ctp-mantle)"/>
    </g>
    <g fill="var(--ctp-overlay0)" font-family="var(--font-display, sans-serif)" font-weight="900">
      <text x="62" y="32" font-size="14">
        Z
        <animate attributeName="opacity" from="1" to="0" dur="2.4s" repeatCount="indefinite" begin="0s"/>
      </text>
      <text x="74" y="22" font-size="11">
        z
        <animate attributeName="opacity" from="1" to="0" dur="2.4s" repeatCount="indefinite" begin="0.6s"/>
      </text>
      <text x="84" y="14" font-size="8">
        z
        <animate attributeName="opacity" from="1" to="0" dur="2.4s" repeatCount="indefinite" begin="1.2s"/>
      </text>
    </g>
  </svg>
  <figcaption>I wake up to merged pull requests.</figcaption>
</figure>

This is the part that still feels new — **work happens while I sleep.** Long-running tasks. I wake up to four merged pull requests. I review them with my coffee. The cycle keeps moving.

## Why This Matters For You

I co-manage **Uber.com** and **Uber Eats**. These are billion-dollar websites. They are hard to build and hard to keep running. The teams behind them are large and expensive. There are good reasons for that.

But here is a question. What if a small coffee shop in your town could have the same quality website? What if a local florist could have the same checkout flow? What if a hair salon could have the same kind of AI helping it?

> Small and medium businesses are about to become their own Shopify. Their own brand studio. Their own engineering team.

The way they will do it is by hiring people like me — and there are about to be a lot more of us — who can ship at full scale because the tools no longer slow us down.

I think of it like real estate. Real estate agents serve neighborhoods. I want to serve small businesses, neighborhood by neighborhood, brand by brand. Build them a site. Build them a checkout. Run it for them, full service. A tiny team of humans, with an enormous team of AI behind us.

## The Floor Is Rising

Here is the line I keep coming back to.

> **We are only bound by our ideas now.**

Not by typing speed. Not by which framework we know. Not by the size of our team.

If you can describe what you want — clearly, in plain words — you can ship it.

This post is the proof. So is the Discord widget on the next article over. So is the math game my son plays.

I will show you more soon.
