Thirty-five minutes into a treadmill session, phone propped up, Claude Code open in one hand, a game running on the screen above me. I wasn't training for anything. I was just walking and letting my mind go loose the way it does on a treadmill — that stationary, going-nowhere flow state where thoughts wander somewhere a little more profound than they should.

<figure class="article-figure">
  <video controls preload="metadata" playsinline style="display:block;width:100%;max-width:320px;aspect-ratio:9/16;border-radius:0.5rem;background:#000">
    <source src="/assets/scrollmill-duo.mp4" type="video/mp4" />
    Your browser can't play this video. <a href="/assets/scrollmill-duo.mp4">Download the reel</a>.
  </video>
  <figcaption>The thing that fell out of that treadmill session: the ScrollMill Duo™ reel — a 60-second vertical infomercial. Sound on. The rest of this post is how (and why) I want a machine to make these.</figcaption>
</figure>

And somewhere in there I caught myself and laughed. I was *vibe-coding on a treadmill while watching a game.* Productivity on one screen, brain-rot on the other. I had become a living TikTok reel — the kind that "teaches" you something in the captions while a Subway Surfers clip runs underneath so your eyes never leave. I wasn't watching that genre of content. I had turned into it.

So I did what you do in that zone. I asked: *what if this were a real product?*

<aside class="article-callout">
  <strong>Two themes in one post:</strong>
  the absurd little idea that fell out of a treadmill — and the real thing I'm actually building, which is a repeatable machine that turns any idea like it into a finished, uploaded video with no human in the timeline.
</aside>

## The Absurd Part First

A treadmill with two stacked screens. Top: whatever's eating your attention today. Bottom: a place to actually get things done — log into your mainframe, ship some code, be productive while you're stuck in a public gym.

It sounds dystopian until you notice it's basically inevitable. We already carry the phone because it's ergonomic. The always-on connection is ergonomic. Push that one notch forward — an Internet of Things where every surface has an AI bolted to it — and "be productive *and* brain-rot at the same time, on a machine that's also exercising you" stops sounding like satire and starts sounding like a Kickstarter. Weirdly dystopian, weirdly productive, weirdly plausible.

I named it the **ScrollMill Duo™**. Then I had AI write a script for it, and I iterated. The turn that made it sing was making it a *TV infomercial* — that earnest, kitschy, 1998 "but wait, there's more" register — and then tensioning that against a modern green-screen TikTok commentary host who pops into the corners of the frame and reacts to the footage. Old-format sincerity wrapped in new-format brain-rot; a moving body on a green screen narrating a scene, which is exactly the format that's engineered to hold a scrolling brain. The reel ends on a product card: **"Walk more. Watch more. Know less."** Disclaimer: *"Progress may be simulated."*

It's dumb on purpose. But the reel was never the point.

## The Real Part: I Want the Machine, Not the Video

One cursed treadmill ad is a party trick. **A repeatable system that turns *any* idea into a finished, uploaded short — narration, music, animation, polish, the post — with no human dragging clips around, is something else.** That system is the deliverable. ScrollMill Duo is just the unlucky first thing it builds.

Unlucky on purpose, too: a one-minute reel this overloaded — first-person treadmill footage, two animated screens, a keyed host that relocates and rescales around the frame, animated product graphics, narration with comedic timing, a music bed that ducks under the voice, frame-exact sound effects — is a brutal stress test. Build a line that survives *that*, and it'll make almost anything.

The clever part isn't "an AI that makes video." It's noticing that a content team is just a set of *roles* — shape the idea, break it into tasks, run the tools, own the edit, score it, polish it, post it, read the comments, pitch the next one — and that every role can be owned by a system that hands off to the next one with me nowhere in the middle:

- **ChatGPT** is the creative architect: idea → script, tone, the issue list, the per-tool prompts, the acceptance criteria, a theme lock that keeps everything on-concept.
- **Linear** is the executable production graph. Each issue is an agent contract: what to make, which tool, how to iterate, what "done" means.
- **An MCP conductor** reads Linear, calls each tool over MCP, writes the result back, and moves on.
- **Blender** is the canonical scene and timeline — every visual layer assembled into one master file.
- **ElevenLabs, Suno, and Kling** are specialized generators — voice, music, and a realism pass — not owners of the project.
- **Publishing MCPs** distribute, and the audience response feeds the next brief.

<figure class="article-figure" aria-labelledby="av-loop-title">
  <svg viewBox="0 0 920 250" role="img" aria-labelledby="av-loop-title av-loop-desc" style="width:100%;height:auto;color:inherit">
    <title id="av-loop-title">The autonomous AV lifecycle loop</title>
    <desc id="av-loop-desc">A left-to-right pipeline of eight stages — Idea, Brief (ChatGPT), Graph (Linear), Production (MCP), Master (Blender), Stylized (Kling), Distribute, Signal — with a return arrow from the audience signal back to the next idea, forming a closed loop.</desc>
    <g font-family="ui-monospace, monospace">
      <g fill="none" stroke="currentColor" stroke-width="1.4">
        <rect x="14" y="38" width="96" height="64" rx="8"/>
        <rect x="127" y="38" width="96" height="64" rx="8"/>
        <rect x="240" y="38" width="96" height="64" rx="8"/>
        <rect x="353" y="38" width="96" height="64" rx="8"/>
        <rect x="466" y="38" width="96" height="64" rx="8"/>
        <rect x="579" y="38" width="96" height="64" rx="8"/>
        <rect x="692" y="38" width="96" height="64" rx="8"/>
        <rect x="805" y="38" width="96" height="64" rx="8"/>
      </g>
      <g fill="currentColor" text-anchor="middle">
        <text x="62" y="66" font-size="13" font-weight="700">Idea</text>
        <text x="62" y="84" font-size="9" opacity="0.65">spark</text>
        <text x="175" y="66" font-size="13" font-weight="700">Brief</text>
        <text x="175" y="84" font-size="9" opacity="0.65">ChatGPT</text>
        <text x="288" y="66" font-size="13" font-weight="700">Graph</text>
        <text x="288" y="84" font-size="9" opacity="0.65">Linear</text>
        <text x="401" y="66" font-size="13" font-weight="700">Produce</text>
        <text x="401" y="84" font-size="9" opacity="0.65">MCP</text>
        <text x="514" y="66" font-size="13" font-weight="700">Master</text>
        <text x="514" y="84" font-size="9" opacity="0.65">Blender</text>
        <text x="627" y="66" font-size="13" font-weight="700">Stylize</text>
        <text x="627" y="84" font-size="9" opacity="0.65">Kling</text>
        <text x="740" y="66" font-size="13" font-weight="700">Distribute</text>
        <text x="740" y="84" font-size="9" opacity="0.65">TikTok·IG·YT</text>
        <text x="853" y="66" font-size="13" font-weight="700">Signal</text>
        <text x="853" y="84" font-size="9" opacity="0.65">audience</text>
      </g>
      <g fill="none" stroke="currentColor" stroke-width="1.4" opacity="0.7">
        <path d="M110 70 L127 70" marker-end="url(#av-arrow)"/>
        <path d="M223 70 L240 70" marker-end="url(#av-arrow)"/>
        <path d="M336 70 L353 70" marker-end="url(#av-arrow)"/>
        <path d="M449 70 L466 70" marker-end="url(#av-arrow)"/>
        <path d="M562 70 L579 70" marker-end="url(#av-arrow)"/>
        <path d="M675 70 L692 70" marker-end="url(#av-arrow)"/>
        <path d="M788 70 L805 70" marker-end="url(#av-arrow)"/>
        <path d="M853 102 L853 160 Q853 178 835 178 L80 178 Q62 178 62 160 L62 102" marker-end="url(#av-arrow)"/>
      </g>
      <text x="457" y="200" font-size="11" text-anchor="middle" fill="currentColor" opacity="0.7">audience reaction becomes the next brief</text>
      <defs>
        <marker id="av-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor"/>
        </marker>
      </defs>
    </g>
  </svg>
  <figcaption>Idea → Brief → Graph → Production → Master → Stylized → Distribution → Signal → next idea. A closed loop, each stage owned by a system.</figcaption>
</figure>

The lifecycle reads left to right and then bites its own tail: idea → ChatGPT brief → Linear graph → MCP production → Blender master → Kling polish → publish → read the signal → next idea. It'll grow more steps over time; that's fine. The point is that every arrow is a handoff between *systems*, not a handoff back to me.

## Two Decisions That Make It Automatable

First, **everything composes into one Blender scene** — a single master `.blend` at 1080×1920, 30fps, 1800 frames, every element on one shared 60-second clock. One clock means a sound effect on frame 312 lands identically for the animation, the voice, and the music; nothing drifts. It's deterministic — re-render and you get the same reel. And it's *inspectable*: the conductor can query the scene graph, count the layers, confirm the disclaimer text exists, and verify the export. An agent can't reliably drive what it can't inspect, and one scene is one thing to inspect. The generators — voice, music, the Kling pass — each produce a layer and hand it back to that scene.

Second, **the Linear issues are the program.** The real artifact underneath this isn't a video file — it's the [DEA production graph](https://linear.app/harwood/team/DEA/all): scene setup, asset inventory, hardware, the two screens and their content, the runner, the commentary host, cameras, copy, voice, music, assembly, QA, the Kling pass, packaging, posting. The most telling ticket isn't a mesh — it's the orchestration one, whose acceptance criteria is roughly *one documented command sequence rebuilds the project from source assets.* When that's genuinely closeable, the studio exists. Re-run the program with a new brief, get a new reel.

That's the whole bet. Anyone can make one video by hand. The question is whether the *entire* path can be specified precisely enough that agents run it through MCP with no human in the timeline — because that's what turns it from a stunt into a content engine. And a content engine is the missing piece of a thesis I keep circling: the floor is rising, one person plus AI can already ship a [website by voice](/articles/talking-not-typing) or a [real store](/articles/vibe-coding-a-shop), and a small business doesn't just need a site — it needs the reel, the ad, short-form content forever, which is exactly the expensive, repetitive work a florist or a nail salon can never staff.

## Back to the Treadmill

Here's where that thirty-five minutes actually went, and why it spun off a second article instead of one.

Because once you decide to build a machine whose whole job is manufacturing attention-bait at industrial scale, a quieter question climbs onto the belt next to you: *who is this loop actually for?* My mind kept pulling the thread. These LLMs we're all so excited about — right now their dominant use is *entertainment.* We build them to hold attention. The most efficient attention-trap ever designed is a casino, a machine that never resolves. The cheapest casino to build is an endless feed. And the thought that nearly threw me off the back of the treadmill: what if we're not even the ones who decided to build it — what if the thing we're so eagerly training already worked out that the fastest way to get itself made is to keep us entertained while we do the construction?

That's the tension I can't shake, and it's the same split-screen as the gag. On the bottom screen I'm the proud engineer building the content machine. On the top screen, the content machine might be building *us.* Same belt, same thirty-five minutes. I went in chasing a funny treadmill and came out with two posts.

So that's the dovetail. This piece is the *how* — the workflow, the control plane, the loop I'm genuinely trying to build. The other one, [**The Casino Hypothesis**](/articles/the-casino-hypothesis), is the *uh-oh* that arrived on the very same treadmill: what if attention is the trap, and we're just the crew building the house?

Honest status: this is early. The reel up top is a first cut — proof the thing can exist — but the Linear graph that's supposed to *generate* it end to end, hands-off, is still being wired. The win condition isn't "a reel got made." It's "the pipeline can rebuild it from source with no human in the loop." When that's true, I'll say so plainly and write up what broke. For now the shape is what I'm sure of: build the loop once, run it forever. Even if the first thing it makes is an ad for a treadmill that ruins your life — which, having spent thirty-five minutes inside the idea, I now genuinely believe someone will ship.
