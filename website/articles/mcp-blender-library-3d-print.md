This is the project I want with my seven-year-old: sit down, describe a tiny toy, let an agent drive Blender through MCP, clean up the mesh, and carry one boring little `.stl` file to the library.

Not a Warhammer model. Not a Space Marine. No borrowed armor, logos, factions, skulls, purity seals, or proprietary silhouette. Just an original kid-designed **tiny war-hammer hero**: a chunky little tabletop figurine with a round base, a big ceremonial hammer, and shapes simple enough for a public-library FDM printer.

The point is not to make the best miniature on Earth. The point is to make the loop visible to a kid:

1. describe it
2. watch Blender build it
3. fix the parts that will fail
4. slice it
5. print it
6. hold it

## What I Learned First

Most library 3D printing is not the same thing as buying a resin mini from a game store.

Libraries usually run FDM printers: melted plastic filament, layer by layer. The good news is that FDM is cheap, sturdy enough for a kid, and usually runs PLA, which is the beginner-friendly material. Prusa's PLA guide calls it inexpensive, easy to print, good for detailed models and figures, and low-warp. The bad news is that PLA is not magic: it gets soft in heat, can be brittle, and it is not something I would use for food-contact objects.

The printers I expect to find in a library or school lab are often in the same size class as a Prusa MINI+ or Bambu A1 mini. Both have a 180 x 180 x 180 mm build volume. That is enormous for a 55 mm figurine. The constraint is not bed size. The constraint is detail, supports, print time, and library policy.

Layer height matters, but it is not the whole story. Prusa's slicer docs are blunt about this: layer height changes vertical resolution, not fine XY detail. If we are using the standard 0.4 mm nozzle, a 0.12 to 0.16 mm layer height is the practical "small figure" zone. If the library has a 0.2 mm nozzle and will use it, great. If not, the model needs chunky forms.

The design rules:

- Big readable silhouette.
- No tiny fingers.
- No thin hammer handle.
- No floating cape.
- No sharp spikes.
- No realistic weapon replica.
- Arms connected to the body.
- Hammer head close enough to the body that supports are manageable.
- Round base, because feet fail.

That last one is the adult part of the project. My son can ask for "huge hammer, angry eyebrows, robot boots." I translate that into printable geometry.

## The Stack

We need four pieces.

```bash
brew install uv
```

Then install Blender 3.0 or newer.

Then connect an agent to Blender through MCP. MCP is the bridge: a standard way for an AI app to talk to external tools. In this project, the external tool is Blender.

For Codex:

```bash
codex mcp add blender -- uvx blender-mcp
codex mcp list
```

For Claude Code:

```bash
claude mcp add blender -- uvx blender-mcp
claude mcp list
```

Then install the Blender add-on from the BlenderMCP repo:

1. download `addon.py`
2. open Blender
3. go to `Edit -> Preferences -> Add-ons`
4. click `Install...`
5. select `addon.py`
6. enable `Interface: Blender MCP`
7. open the 3D View sidebar with `N`
8. find `BlenderMCP`
9. click `Connect to Claude`

The add-on opens a local socket server inside Blender. The MCP server talks to that socket. The agent gets tools for scene inspection, object creation, material changes, and Blender Python execution.

That last part matters: this is powerful and dangerous. Save the file before letting an agent run code. Use a throwaway Blender scene. Do not connect random MCP servers you do not trust.

## The Parent Prompt

I would start with one prompt, said out loud with my son next to me:

> We are making an original 55 mm tall toy figurine for FDM 3D printing at a public library. Do not copy Warhammer, Space Marines, Games Workshop, or any existing franchise. Make a kid-safe fantasy "hammer hero" on a 28 mm round base. Use simple Blender primitives and bevels: round helmet, blocky torso, boots, mitten hands, oversized ceremonial hammer held close to the body. No sharp points. Minimum feature thickness 1.2 mm. Keep overhangs modest. Make all visible parts joined or touching so the STL is printable. Add named objects and simple materials only for preview. After creating it, inspect the scene and tell me what may fail in FDM printing.

Then I would make my son the creative director:

- What shape is the helmet?
- Happy eyebrows or serious eyebrows?
- Round hammer or square hammer?
- Boots or robot feet?
- Initials on the base?

The trick is to keep his choices cosmetic. The printability rules stay fixed.

## The Model Recipe

Here is the rough shape I want the agent to build in Blender.

### Base

- cylinder
- 28 mm diameter
- 3 mm tall
- bevel the top and bottom edges
- add a small name plate on the front, but keep letters raised and thick

### Body

- torso as a rounded cube, about 15 mm tall
- head as a sphere, about 10 mm wide
- helmet ridge as a rounded bar, not a spike
- legs as two chunky tapered cylinders
- boots fused into the base

### Arms

- arms as curved tubes or bevelled cylinders
- no gap between shoulder and torso
- mitten hands, not fingers
- hands touch the hammer handle and torso

### Hammer

- handle: 2.4 to 3 mm thick
- head: chunky cuboid or cylinder, 10 to 12 mm wide
- keep it close to the body
- rotate it diagonally for character, but avoid a long unsupported horizontal bar

### Print Safety

The hammer should read as a toy prop, not a weapon replica. Some library makerspaces explicitly ban weapons, weapon parts, accessories, or replicas. A tiny fantasy figure may still be fine, but the adult move is to call it a **hammer hero figurine** and ask staff before submitting the file.

## The Cleanup Prompt

After the first generation, I would not print yet. I would ask for a printability pass:

> Inspect this Blender scene for FDM printing. Make a checklist of every object thinner than 1.2 mm, every unsupported overhang, any separated floating geometry, and anything that may fail as a public-library PLA print. Then fix the mesh by thickening weak features, moving the hammer closer to the body, joining contact points, applying bevels, applying transforms, and making the silhouette simpler.

Then:

> Convert the final model to a single printable mesh. Apply all modifiers. Set scene units to millimeters. Make the final height 55 mm including the base. Add a small hidden text label on the underside that says "Dean + Dad 2026". Run Blender's 3D Print Toolbox checks if available and report non-manifold edges, thin walls, and overhang risk.

I want this to be boring. Boring prints.

## Blender Checks

Before export:

1. Set units to millimeters.
2. Apply scale and rotation.
3. Apply modifiers.
4. Make one final joined mesh or a small set of clearly intersecting solids.
5. Enable the 3D Print Toolbox.
6. Run checks for non-manifold edges, wall thickness, and overhangs.
7. Fix anything obvious.
8. Export STL with scene units applied.

Blender's STL exporter is meant for sending mesh geometry to 3D printing software. The important checkbox is scene units, because a 55 mm model accidentally exported as 55 meters or 55 Blender units is how a library staff member has a bad afternoon.

## Slicer Settings

If the library lets us slice it ourselves in PrusaSlicer, Bambu Studio, or Cura, I would start here.

```text
material: PLA
nozzle: 0.4 mm unless library offers 0.2 mm
layer height: 0.12 or 0.16 mm
first layer: 0.20 mm
perimeters/walls: 3
infill: 10-15%
supports: organic/tree, build plate only if possible
brim: yes, 3-5 mm if the base is small
scale: 55 mm tall
orientation: upright on the base
```

Why not chase 0.05 mm layers? Because print time explodes, and on a public library printer time is a shared resource. Prusa's own docs say 0.10 mm already buys extra detail and going lower tends to cost a lot of time for a relatively small improvement.

If the slicer says the print will take six hours, I would scale down, simplify, or split the project. Many libraries have time limits or reservation windows.

## Library Checklist

Before we go:

- library card
- appointment if required
- parent present
- closed-toe shoes if it is a full makerspace
- STL file
- sliced file only if the library asks for it
- screenshot of the model
- print time estimate
- note that it is an original toy figurine, not a weapon replica

Questions to ask staff:

- Do you print only PLA?
- Do you slice the file, or should I bring G-code?
- What is the max print time?
- Are toy fantasy props allowed?
- Can a seven-year-old participate if I am present?
- Do you have a 0.2 mm nozzle, or should we design for 0.4 mm?

If the answer on the hammer is no, we pivot. Same body, same base, new prop: wrench, flag, lantern, trophy, or moon staff.

## The Kid Part

The best part of this project is that a child can understand the feedback loop.

When the hammer handle is too skinny, we can show him the slicer preview and say: "The printer cannot draw a line that small."

When the hammer floats in the air, we can show him supports and say: "Plastic cannot print on nothing."

When we thicken the boots, we can say: "Feet need to survive the backpack ride home."

That is the lesson. Not Blender. Not MCP. Not even 3D printing.

The lesson is that ideas become things through constraints.

## My Final Prompt Before Export

> Make the final mesh library-safe and FDM-friendly. The figure should be cute, chunky, original, and printable in PLA on a 0.4 mm nozzle. Remove franchise-like details. Remove sharp points. Keep the ceremonial hammer close to the body. Ensure no feature is thinner than 1.2 mm. Scale to 55 mm tall including a 28 mm round base. Apply all transforms and modifiers. Export `hammer-hero-dean-dad.stl`.

Then I put that file on a USB drive, go to the library, and let my son hand it to the person at the desk.

If the print works, we paint it badly.

That part is mandatory.

## Sources I Trusted

- [Model Context Protocol introduction](https://modelcontextprotocol.io/docs/getting-started/intro)
- [Claude Code MCP docs](https://code.claude.com/docs/en/mcp)
- [OpenAI Docs MCP setup for Codex](https://developers.openai.com/learn/docs-mcp)
- [BlenderMCP GitHub repo](https://github.com/ahujasid/blender-mcp)
- [Blender 3D Print Toolbox manual](https://docs.blender.org/manual/en/latest/addons/mesh/3d_print_toolbox.html)
- [Blender STL export manual](https://docs.blender.org/manual/en/latest/files/import_export/stl.html)
- [Prusa PLA guide](https://help.prusa3d.com/article/pla_2062)
- [Prusa layer height and perimeter guide](https://help.prusa3d.com/article/layers-and-perimeters_1748)
- [Prusa MINI+ specs](https://www.prusa3d.com/product/original-prusa-mini-kit-2/)
- [Bambu Lab A1 mini specs](https://bambulab.com/cs/a1-mini/tech-specs)
- [High Plains Library District 3D printing rules](https://www.mylibrary.us/3dprint/)
