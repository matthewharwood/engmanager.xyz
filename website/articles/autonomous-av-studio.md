I can ship a website by talking. I can stand up a store by talking. The next thing I want to talk into existence is harder, and weirder: a finished, uploaded, 60-second video — narration, music, animation, the works — made end to end by agents driving real production tools through MCP.

Not a slideshow. Not a stock-footage montage with a robot voice on top. An actual little film, composed in Blender, scored by Suno, narrated by ElevenLabs, exported at vertical phone resolution, and pushed to TikTok, YouTube, and Instagram. No human touching a timeline.

<aside class="article-callout">
  <strong>The experiment:</strong>
  build an autonomous AV studio — a repeatable machine where a script goes in one end and a finished, uploaded reel comes out the other — using only Blender, Suno, and ElevenLabs, each wired up over MCP. Prove it once on a deliberately cursed example, then run it again and again.
</aside>

This is the part I want to say up front, because it is the whole point: **this post is not about the video.** It is about the machine that makes the video. One reel is a stunt. A pipeline that turns *any* script into a reel is a business. I am using one ridiculous example as the case study, but the deliverable I actually care about is the assembly line behind it.

This is also an early-state writeup. The pipeline is being built as a stack of [Linear](https://linear.app/harwood/team/DEA/all) issues right now, and the real rendered assets — the actual frames, the actual audio, the actual uploaded reel — will land later. I am publishing the thinking first and will come back to swap in the real thing once it exists. Consider this the blueprint, not the ribbon-cutting.

## The Case Study: A Cursed Treadmill Infomercial

To stress-test a system, you don't hand it the easy version. You hand it the version that would make a human production team groan.

So the test reel is a fake infomercial for something called the **ScrollMill Duo™** — a treadmill with two screens bolted to it. Top screen: a tiny indie wizard game running forever. Bottom screen: a vague AI coding interface where a jogger keeps tapping "looks good" and "accept changes" without breaking stride. Over the top of all of it, a badly-keyed green-screen commentary host pops into the corners of the frame like a TikTok reaction creator, freezing the footage, circling things, and narrating the descent.

The host's pitch lands the joke: *"It's not multitasking. It's stacked dissociation."* The reel ends on a fake product card — **"Walk more. Watch more. Know less."** — with a tiny disclaimer reading *"Progress may be simulated."*

It is dumb on purpose. It is also, from a production standpoint, a nightmare in the best possible way. Look at what one minute of that actually requires:

- First-person treadmill footage that runs the whole time.
- A working-looking indie game on the top panel.
- A working-looking AI coding UI on the bottom panel, with text that changes — `continue?`, `retry?`, `accept changes?`, `looks good?`, `Task complete.`
- A green-screen human host that relocates around the frame, scales up and down, and gestures at things.
- On-screen product graphics that animate in — the `SCROLLMILL DUO™` label, the end card, the disclaimer.
- Narration with comedic timing and pauses.
- Background music that sits under the voice without fighting it.
- Sound effects landing on exact frames — the record-scratch freeze, the infomercial sparkle hit.

That is dozens — realistically hundreds — of layers, all of them landing on a single shared 60-second clock. If the studio can build *that* without a human dragging clips around, it can build almost anything I'd ever want to post.

## The Constraint That Makes It Scale

Here is the rule that turns a one-off into a system: **only three tools, each reachable over MCP.**

- **Blender** is the stage, the camera, the compositor, and the render farm. Every visual layer lives here.
- **ElevenLabs** is the voice. It produces the host's narration.
- **Suno** is the band. It produces the background music.

MCP — the Model Context Protocol — is the bridge that lets an agent actually *operate* each of these instead of just talking about them. I've written before about [driving Blender through MCP to 3D-print a toy](/articles/mcp-blender-library-3d-print) and about [shipping software by talking, not typing](/articles/talking-not-typing). This is the same move, pointed at video. The agent doesn't render a suggestion for me to execute; it executes.

Why these three and nothing else? Because the constraint *is* the design. Every tool you add to a creative pipeline is another surface that can drift, another set of file formats to reconcile, another place a human has to step in and babysit. Three tools with MCP control surfaces is the smallest stack that can produce a fully-scored, fully-narrated animated reel. Limiting it to three is what makes the loop describable — and a loop you can describe is a loop you can automate and re-run.

<div class="workflow">
  <div class="workflow-stage workflow-stage-single">Script</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-list">
    <div class="workflow-stage-title">MCP</div>
    <ul class="workflow-stage-items">
      <li>Blender</li>
      <li>ElevenLabs</li>
      <li>Suno</li>
    </ul>
  </div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">One 60s Scene</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">Reel</div>
  <div class="workflow-arrow" aria-hidden="true">→</div>
  <div class="workflow-stage workflow-stage-single">TikTok · YT · IG</div>
</div>

## One Scene to Rule Them All

The most important architectural decision is also the most boring-sounding: **everything composes into a single Blender scene.**

Not a folder of clips stitched together in an editor later. Not "render the host here, render the treadmill there, marry them in DaVinci." One `.blend` file that holds the treadmill, the dual screens, the on-screen text, the green-screen host, the camera moves, the timing markers — every visual element as an object on one shared 60-second timeline. Blender records that timeline as video, and Blender's compositor and sequencer line the ElevenLabs voice and the Suno music up against the exact same clock.

This matters for the same reason a single source of truth matters in code. When the whole film is one scene:

- **There is one clock.** A sound effect on frame 312 means the same thing to the animation, the narration, and the music. No drift between tools.
- **It is deterministic and re-runnable.** Re-render the scene and you get the same reel. Change one line of narration timing and re-render — nothing downstream needs to be manually re-synced.
- **It is inspectable.** An agent can query the scene graph, count the layers, check that the disclaimer text actually exists, and verify the export resolution — because it's all in one queryable place.

That last point is what makes it *automatable* rather than just *automated-once*. An agent can't reliably drive a process it can't inspect. One scene is one thing to inspect.

## The Layer Inventory

Before anything animates, the studio has to do what a real AV team does on day one: take the script apart and make a list of every single thing that has to exist. Every mesh, every material, every piece of text, every audio cue. Nothing gets built that isn't on the list; nothing on the list gets skipped.

For the ScrollMill reel, that inventory breaks into a few families:

### Geometry and props

The treadmill itself — frame, belt, side rails, the dual-screen mount. The two screens as real surfaces in 3D space. A stylized runner. The little indie-game wizard that also runs endlessly on the top panel. The fake product packaging for the end card. Every one of these is either modeled from primitives in Blender or fetched and cleaned up, then placed in the one scene.

### Screen content

The top panel needs a looping wizard-game reel. The bottom panel needs an AI-coding UI whose text changes on cue. The product label, the end card, and the disclaimer are all text-and-graphics layers that animate in at specific frames. On-screen text is its own production problem — it has to be legible at phone size and land on the beat of the narration.

### The host

The green-screen commentary host is the hardest single element. It's a human-presenting layer that has to be keyed, float over the footage, relocate to different corners, scale from a tiny full-body cutout to a giant face close-up, and gesture at UI elements — all while staying in sync with the voice track. This is where "badly-keyed on purpose" is doing real work: the aesthetic forgives a lot of the things that are genuinely hard about compositing a person over footage.

### Audio

One narration track from ElevenLabs, performed with the comedic pauses the script calls for. One background music bed from Suno that ducks under the voice. A handful of sound effects — the record-scratch freeze-frame, the infomercial sparkle hit — placed on exact frames.

### Camera, timing, and export

The camera moves and framing — first-person jog bounce, the tilt-up reveal, the screen inserts, the freeze-frame, the pullback to the final product shot. The master timeline with shared markers on every beat: 0:00, 0:05, 0:13, 0:24, 0:35, 1:00. And the export settings, pinned down to the number: **1080×1920 portrait, 30fps, 1800 frames, H.264 with AAC audio** — vertical phone resolution, ready to upload, rendered both clean and caption-safe.

Hundreds of layers. One timeline. That's the job.

## The Pipeline, End to End

Strung together, the studio runs as a sequence of stages, each one a thing an agent can do over MCP and verify before moving on:

1. **Parse the script** into an exhaustive inventory of every layer, every cue, and every timing beat.
2. **Build or fetch every visual asset** — meshes, materials, screen content, text, the host — into Blender.
3. **Compose them into one scene** on a single 60-second timeline, with markers for every beat.
4. **Animate** — camera moves, host relocations, text reveals, the runner's loop, the screen-text changes.
5. **Generate the narration** with ElevenLabs and line it up against the timeline.
6. **Generate the music** with Suno and line it up under the voice.
7. **Place the sound effects** on their exact frames.
8. **Play back and record** the scene as video inside Blender.
9. **Export** at vertical short-form resolution — the finished reel.
10. **Upload** to TikTok, YouTube Shorts, and Instagram.

Every one of those is a station on the assembly line. The win condition isn't "the reel got made." It's "each station can be driven by an agent through MCP, verified, and re-run — so the next script flows through the same line without me touching it."

## The Issues Are the Program

The way I'm building this is the same way I build everything now: I describe the end-to-end process as a stack of Linear issues, then point an agent at them and say *work through these.*

So the real artifact underneath this article isn't a video file. It's a set of issues on the [DEA team in Linear](https://linear.app/harwood/team/DEA/all) that describe, layer by layer and stage by stage, the entire path from "here is a script" to "the reel is live on three platforms." Each issue covers one piece — a mesh to model, a screen to populate, the host to key, the voice to generate, the music to score, the export to configure, the upload to fire — and each one is written to be executed by an agent over MCP, not by a person clicking through Blender.

<aside class="article-callout">
  <strong>The instruction that defines "done":</strong>
  loop and don't stop until every issue has been created, and you're confident the whole thing can run fully automated via MCP alone. If a step still needs a human hand on the mouse, it isn't an issue yet — it's a gap.
</aside>

That last bar is the real test of the design. Anyone can make one video by hand. The question I'm actually asking is whether the *entire* path — every mesh, every layer, every audio cue, every export setting, every upload — can be specified precisely enough that an agent runs the whole thing through MCP with no human in the timeline. If it can, the issues stop being a to-do list and become a program. Re-run the program with a new script and you get a new reel.

The most telling issue in the whole stack isn't a mesh or a voice line. It's the orchestration ticket — the one whose acceptance criteria is, roughly, *one documented command sequence can rebuild the project from source assets:* scene setup, asset generation, animation assembly, audio import, render, QA export, final package. When that ticket is genuinely closeable, the studio exists. Everything else is just the first thing it builds.

> The reel is the output. The pipeline is the product. I'm not trying to make a video — I'm trying to make a machine that makes videos.

## Why I Actually Care About This

I keep coming back to the same thesis. The floor is rising. One person plus AI can now ship things that used to need a team — a [Rust website by voice](/articles/talking-not-typing), a [real store with real checkout](/articles/vibe-coding-a-shop), and the bigger bet underneath both of those, [Project FootTraffic](/articles/project-foottraffic): serving small businesses the way a real estate agent serves a neighborhood.

Video is the missing piece of that picture. A small business doesn't just need a website and a checkout. It needs the reel. It needs the ad. It needs short-form content, constantly, forever, and that is exactly the kind of work that is expensive, repetitive, and slow when a human has to sit in an editor for every fifteen-second clip. The florist can't afford a video team. The nail salon can't afford a motion designer. The same way I want one person to be able to stand up a store, I want one person to be able to stand up a content engine.

That's why the constraint is scale and not polish. A pipeline that makes one perfect cursed treadmill ad is a party trick. A pipeline that takes *any* script and reliably returns an uploaded reel is the thing that makes the rest of the plan work. The ScrollMill Duo is just the unlucky volunteer I'm using to find the broken stations on the line.

## Where This Is Right Now

Honest status: this is early. The Linear issues are being written and worked. The real assets — the modeled treadmill, the keyed host, the ElevenLabs voice take, the Suno score, the actual exported and uploaded reel — don't exist yet. When they do, I'll come back and replace these words with the real frames and the real audio, and I'll write up what broke, because something always breaks.

What I'm confident about is the shape of it: one script, three MCP-driven tools, one Blender scene, one timeline, one assembly line of issues, and a finished reel on the other side. Build the line once. Run it forever.

I'll show you the first reel soon. Even if it is about a treadmill that ruins your life.
