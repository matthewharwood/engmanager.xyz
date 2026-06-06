I can ship a website by talking. I can stand up a store by talking. The next thing I want to talk into existence is harder and weirder: a finished, uploaded, 60-second video — narration, music, animation, the works — made end to end by agents driving real production tools.

But here's the part that matters, and it's the whole reason I'm writing this down. **I don't actually want a video. I want the machine that makes videos.** One reel is a stunt. A repeatable system that turns *any* idea into an uploaded reel — on a loop, with a human nowhere near a timeline — is something else entirely. That system is the deliverable. The reel is just the first thing it spits out.

<aside class="article-callout">
  <strong>The experiment:</strong>
  build a reusable AV automation control plane — a loop where a raw idea goes in one end and a finished, published short-form video comes out the other, then the audience's reaction becomes the next idea. Prove the loop once on a deliberately cursed example, then run it again and again on autopilot.
</aside>

This is also an early-state writeup. The first run is being built right now as a stack of [Linear](https://linear.app/harwood/team/DEA/all) issues, and the real rendered assets — the actual frames, the actual audio, the actual uploaded reel — will land later. I'm publishing the architecture first and will come back to swap in the real thing. Consider this the blueprint, not the ribbon-cutting. The workflow will also keep growing more steps over time; what follows is the truth as it stands today.

## The Real Idea: A Control Plane, Not a Render

Here's the clever bit, and it's the thing I'm actually testing.

A content team is a set of *roles* passing work down a line: someone shapes the idea, someone breaks it into tasks, someone operates the tools, someone owns the edit, someone scores it, someone polishes it, someone posts it, someone reads the comments and pitches the next one. The insight is that **every one of those roles can be owned by a system instead of a person — and the systems can hand off to each other without me in the middle.**

So the architecture isn't "an AI that makes a video." It's a control plane where each layer has one job:

- **ChatGPT is the creative systems architect.** It takes a messy idea and produces the script, the tone, the visual language, the issue taxonomy, the per-tool prompts, the runbooks, the acceptance criteria, and a *theme lock* that keeps everything downstream on-concept.
- **Linear is the system of record — the executable production graph.** Each issue isn't just a task; it's an agent contract: what to make, which tool to make it in, how to iterate, and what "done" means.
- **An MCP conductor operates the tools.** It reads Linear, calls the right tool over MCP, writes the artifact back, and moves to the next contract.
- **Blender is the canonical scene and timeline.** Every visual layer assembles into one master file. It's the database the whole production lives in.
- **ElevenLabs, Suno, and Kling are specialized generators**, not owners of the project. Voice, music, and a realism pass — each produces a layer and hands it back.
- **Publishing MCPs distribute**, and the audience response feeds back into the next planning loop.

> The reel is the output. The pipeline is the product. I'm not trying to make a video — I'm trying to make a machine that makes videos, forever, on a loop.

## The Loop

Strung together, the roles form a cycle. An idea enters, becomes a brief, becomes a graph of executable issues, gets produced layer by layer, assembles into one master render, gets a stylistic polish, ships to three platforms, and the audience's reaction becomes the brief for the next one.

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
  <figcaption>Idea → Brief → Graph → Production → Master → Stylized → Distribution → Signal → next idea. A closed content lifecycle, each stage owned by a system.</figcaption>
</figure>

The full lifecycle, stated plainly:

1. **Idea capture** — a raw concept, joke, product gag, or visual premise.
2. **Creative synthesis** — ChatGPT distills it into script, tone, visual language, and the hidden "comment logic" of the joke.
3. **Production graph** — ChatGPT writes a Linear parent issue plus child issues, each carrying an MCP prompt, a runbook, a theme lock, and acceptance criteria.
4. **Asset inventory** — every visible and audio layer becomes a concrete, tracked unit before production starts.
5. **Scene scaffold** — Blender's master scene defines the canonical timeline, output format, collections, and markers.
6. **Layer generation** — assets are created in coordinated lanes: hardware, screens, screen content, characters, cameras, copy, voice, music, effects.
7. **Assembly** — sequence integration pulls every child output onto the same 60-second Blender timeline.
8. **Quality loop** — playblast, review, fix readability/sync/timing/theme drift, repeat.
9. **Clean export** — Blender outputs the canonical vertical master.
10. **Kling style pass** — improve realism and polish while preserving the edit, the text, and the joke.
11. **Post package** — cover frame, title, caption, platform notes, final mobile check.
12. **Publish** — stage to TikTok, Instagram Reels, and YouTube Shorts; record links back in Linear.
13. **Feedback** — comments, completion rate, shares, and saves become the next brief, and ChatGPT turns that into the next production graph.

This list will get longer. That's expected. The point isn't that it's complete — it's that every arrow is a handoff between systems, not a handoff to me.

## The Case Study: A Cursed Treadmill Infomercial

To stress-test a system, you don't hand it the easy version. You hand it the one that would make a human production team groan.

So the first run is a fake infomercial for the **ScrollMill Duo™** — a treadmill with two screens bolted to it. Top screen: a tiny indie wizard game running forever. Bottom screen: a vague AI coding interface where a jogger keeps tapping "looks good" and "accept changes" without breaking stride. Over the top of it all, a badly-keyed green-screen commentary host pops into the corners of the frame like a TikTok reaction creator, freezing the footage, circling things, and narrating the descent.

The host's pitch lands the joke: *"It's not multitasking. It's stacked dissociation."* The reel ends on a fake product card — **"Walk more. Watch more. Know less."** — with a tiny disclaimer reading *"Progress may be simulated."*

It's dumb on purpose. It's also, from a production standpoint, a nightmare in the best possible way. One minute of that requires first-person treadmill footage, a working-looking game on one panel, a working-looking coding UI on the other with text that changes on cue, a keyed human host that relocates and rescales around the frame, animated product graphics, narration with comedic timing, a music bed that ducks under the voice, and sound effects landing on exact frames. Dozens — realistically hundreds — of layers, all on one shared 60-second clock.

If the system can build *that* without a human dragging clips around, it can build almost anything I'd ever want to post. That's the whole reason the unlucky volunteer is so over-built.

## One Scene to Rule Them All

The most important architectural decision is also the most boring-sounding: **everything composes into a single Blender scene.**

Not a folder of clips stitched together in an editor later. One master `.blend` at **1080×1920, 30fps, 1800 frames** that holds the treadmill, the dual screens, the on-screen text, the keyed host, the camera moves, and the timing markers — every visual element as an object on one shared 60-second timeline, with markers on every beat (0:00, 0:05, 0:13, 0:24, 0:35, 1:00). Blender records that timeline; its sequencer lines the ElevenLabs voice and the Suno music against the same clock. The rule is that production stays unified in that one scene unless a child issue *explicitly* exports an intermediate asset and brings it back in.

This matters for the same reason a single source of truth matters in code. When the whole film is one scene:

- **There is one clock.** A sound effect on frame 312 means the same thing to the animation, the narration, and the music. No drift between tools.
- **It is deterministic and re-runnable.** Re-render and you get the same reel. Change one line of narration timing and re-render — nothing downstream needs manual re-syncing.
- **It is inspectable.** The conductor can query the scene graph, count the layers, confirm the disclaimer text exists, and verify the export resolution — because it's all in one queryable place.

That last point is what makes it *automatable* rather than *automated-once*. An agent can't reliably drive a process it can't inspect. One scene is one thing to inspect. Everything else — voice, music, the Kling polish — is a generator that produces a layer and hands it back to the scene.

## The Layer Inventory

Before anything animates, the system does what a real AV team does on day one: it takes the script apart and lists every single thing that must exist — every mesh, material, text plane, and audio cue. Nothing gets built that isn't on the list; nothing on the list gets skipped. For the ScrollMill reel that inventory breaks into a few lanes:

- **Geometry and props** — the treadmill frame, belt, rails, and dual-screen mount; the two screens as real surfaces in 3D space; a stylized runner; the wizard that also runs endlessly on the top panel; the fake product packaging for the end card.
- **Screen content** — the looping wizard-game reel up top; the AI-coding UI below, whose status text changes on cue (`continue?`, `retry?`, `accept changes?`, `Task complete.`); the product label, end card, and disclaimer as text-and-graphics layers that animate in on the beat.
- **The host** — the hardest single element: a keyed, floating cutout that relocates to different corners, scales from a tiny full-body figure to a giant face close-up, and gestures at UI elements while staying in sync with the voice. "Badly-keyed on purpose" is doing real work here — the aesthetic forgives a lot of what's genuinely hard about compositing a person over footage.
- **Audio** — one ElevenLabs narration track with the comedic pauses the script calls for; one Suno music bed that ducks under the voice; a handful of sound effects (the record-scratch freeze, the infomercial sparkle hit) on exact frames, all mixed to stay clear on phone speakers without clipping.
- **Camera, timing, export** — the POV jog bounce, the tilt-up reveal, the screen inserts, the freeze-frame, the pullback to the product shot; the master timeline; and the export, pinned to the number: **1080×1920, 30fps, H.264/AAC**, rendered both clean and caption-safe.

Hundreds of layers. One timeline. That's the job.

## The Issues Are the Program

The way I build this is the way I build everything now: describe the end-to-end process as a stack of Linear issues, then point agents at them and say *work through these.*

So the real artifact underneath this article isn't a video file — it's the [DEA production graph in Linear](https://linear.app/harwood/team/DEA/all). A parent issue holds the creative north star and the theme lock. Child issues cover scene setup, inventory, hardware, screens, top/bottom screen content, the runner, the commentary host, the camera plan, copy, voice, music and SFX, sequence integration, the quality pass, the Kling post-processing, packaging, and channel posting. Each one is written as an agent contract: the MCP prompt, the runbook, and the acceptance criteria for "done," executable by the conductor rather than by a person clicking through Blender.

<aside class="article-callout">
  <strong>The instruction that defines "done":</strong>
  loop and don't stop until every issue exists and you're confident the whole thing runs fully automated via MCP alone. If a step still needs a human hand on the mouse, it isn't an issue yet — it's a gap.
</aside>

The most telling issue in the stack isn't a mesh or a voice line. It's the orchestration ticket, whose acceptance criteria is, roughly, *one documented command sequence can rebuild the project from source assets* — scene setup, asset generation, animation assembly, audio import, render, QA export, final package. When that ticket is genuinely closeable, the studio exists. Everything else is just the first thing it builds.

That's the real test of the design. Anyone can make one video by hand. The question I'm actually asking is whether the *entire* path can be specified precisely enough that agents run it through MCP with no human in the timeline. If it can, the issues stop being a to-do list and become a program. Re-run the program with a new brief and you get a new reel.

## Polish, Publish, and the Loop Back

The Blender master is clean but plain — it's the edit, not the final look. **Kling comes after**, as a realism and style pass that has to preserve everything the master locked in: the timing, the text, the screens, the runner's motion, the overlay host, and the core concept. It makes the thing look like a near-future commercial without touching the joke.

Then the post package — cover frame, title and caption options, platform notes, one last mobile-readability check — and the publishing MCPs stage it to TikTok, Reels, and Shorts. Links go back into Linear.

And then the part that closes the loop: the audience. Comments, completion rate, shares, and saves are data. *What did viewers understand without me explaining it?* That interpretation becomes the next brief — a sharper gag, a stronger theme lock, a reusable template — and ChatGPT turns it into the next production graph. The output of the system becomes the input to the system. That's the loop, and the loop is the actual invention here.

## Why I Actually Care

I keep coming back to the same thesis. The floor is rising. One person plus AI can now ship things that used to need a team — a [Rust website by voice](/articles/talking-not-typing), a [real store with real checkout](/articles/vibe-coding-a-shop), and the bigger bet underneath both, [Project FootTraffic](/articles/project-foottraffic): serving small businesses the way a real estate agent serves a neighborhood.

Video is the missing piece of that picture. A small business doesn't just need a website and a checkout — it needs the reel, the ad, short-form content constantly, forever. That's exactly the work that's expensive, repetitive, and slow when a human sits in an editor for every fifteen-second clip. The florist can't afford a video team. The nail salon can't afford a motion designer. The same way I want one person to stand up a store, I want one person to stand up a content engine — and have it run on a loop.

That's why the experiment is built around a *loop* and a *control plane*, not a single polished render. A pipeline that makes one perfect cursed treadmill ad is a party trick. A pipeline that takes any idea and reliably returns a published reel — then learns from the response and pitches the next one — is the thing that makes the rest of the plan work. ScrollMill Duo is just the unlucky volunteer I'm using to find the broken stations on the line.

## Where This Is Right Now

Honest status: this is early. The Linear graph is being written and worked. The real assets — the modeled treadmill, the keyed host, the ElevenLabs voice take, the Suno score, the Kling pass, the exported and uploaded reel — don't exist yet. When they do, I'll come back and replace these words with the real frames and the real audio, and I'll write up what broke, because something always breaks. The workflow will have more steps by then, too.

What I'm confident about is the shape of it: idea in, control plane runs, reel out, signal back, next idea. ChatGPT architects, Linear records, MCP conducts, Blender holds the truth, the generators fill the layers, the platforms distribute, the audience replies. Build the loop once. Run it forever.

I'll show you the first reel soon. Even if it is about a treadmill that ruins your life.
