"""Sculpt a marble messenger: licensed facial anatomy within unfurling scrolls.

The accepted bust supplies only a sampled face surface. The skull, neck, chest
and shoulders do not appear in this composition. Two original closed stone
scrolls create a fresh silhouette. The complete accepted portrait and scan are
retained as hidden references; coach.blend is never rewritten.
"""

import argparse
import hashlib
import importlib.util
import json
import math
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "website/assets/journey"
spec = importlib.util.spec_from_file_location("coach_source", HERE / "rebuild_coach.py")
coach = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coach)
PARTS = []
COPYRIGHT = (
    'Adapted from "Aristotele bust" by nicola_scaramella. '
    'https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930 '
    'Licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. '
    'Changes: original facial surface cropped and resampled into a shallow '
    'theatrical mask with a flared perimeter and supported bas-relief back; '
    'skull, neck and torso omitted; original unfurling scrolls '
    'with rolled stone edges and shallow carved inscription lines; composition '
    'normalization, marble material and vertex cavity shading. '
    'The accepted coaching sculpture and source remain unchanged.'
)


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections[coach.DISPLAY_COLLECTION].objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    for face in data.polygons:
        face.use_smooth = True
    PARTS.append(obj)
    return obj


def build_mask(portrait, scroll):
    """Sample actual source facial relief; never synthesize facial features."""
    rings, columns = 100, 224
    vertices, faces = [], []
    samples = []
    # A small elliptical crop preserves the natural forehead, eyes, nose,
    # mouth and chin while excluding the full head and bust silhouette.
    for i in range(rings + 1):
        angles = [0] if i == 0 else [math.tau * j / columns for j in range(columns)]
        for angle in angles:
            r = i / rings
            x = .105 + .585 * r * math.cos(angle)
            z = .105 + .78 * r * math.sin(angle)
            found, hit, _, _ = portrait.ray_cast(Vector((x, -4, z)), Vector((0, 1, 0)))
            if not found:
                raise RuntimeError(f"The facial crop leaves the licensed surface at {x}, {z}.")
            samples.append(hit)
    surface = [Vector(((sample.x - .105) * .67, sample.y * .67 + .40,
                       (sample.z - .105) * .67 + .47)) for sample in samples]

    def support(point):
        found, hit, _, _ = scroll.ray_cast(Vector((point.x, -4, point.z)), Vector((0, 1, 0)))
        if not found:
            raise RuntimeError(f"The mask relief leaves its stone scroll support at {point}.")
        return hit.y

    # A softly flared carved border merges the facial crop into the scroll.
    # Unlike a floating mask hung by its forehead, the whole cheek/chin rear
    # is supported. These outer rings are original supporting stone geometry;
    # all inner facial points remain exact samples of the licensed anatomy.
    edge = surface[-columns:]
    collar_rings = 18
    for ring in range(1, collar_rings + 1):
        fraction = ring / collar_rings
        blend = 1 - (1 - fraction) ** 2
        for original in edge:
            point = Vector((original.x * (1 + .14 * fraction), original.y,
                            .47 + (original.z - .47) * (1 + .14 * fraction)))
            plane = support(point) + .009
            point.y = original.y * (1 - blend) + plane * blend
            surface.append(point)
    rings += collar_rings
    # A solid bas-relief back extends a small distance inside the scroll across
    # the entire crop. The attachment is intentional, never a paper-thin shell
    # with an unsupported chin or a new skull/neck behind the face.
    for back in [False, True]:
        for point in surface:
            depth = max(point.y + .035, support(point) + .032) if back else point.y
            vertices.append((point.x, depth, point.z))
    count = len(surface)
    for back in [False, True]:
        offset = int(back) * count
        for j in range(columns):
            face = (offset, offset + 1 + j, offset + 1 + (j + 1) % columns)
            faces.append(tuple(reversed(face)) if back else face)
        for ring in range(rings - 1):
            for j in range(columns):
                a = offset + 1 + ring * columns + j
                b = offset + 1 + ring * columns + (j + 1) % columns
                face = (a, a + columns, b + columns, b)
                faces.append(tuple(reversed(face)) if back else face)
    start = 1 + (rings - 1) * columns
    for j in range(columns):
        a, b = start + j, start + (j + 1) % columns
        faces.append((a, b, b + count, a + count))
    return mesh("Oracle — facial anatomy carved into a theatrical mask", vertices, faces)


def closed_sheet(name, points, width_samples, thickness):
    """Create a closed thick sheet, avoiding zero-thickness paper surfaces."""
    rows = len(points)
    vertices, faces = [], []
    for back in [False, True]:
        for row in points:
            for point, normal in row:
                vertices.append(tuple(point + normal * thickness * (.5 if back else -.5)))
    count = rows * width_samples
    for back in [False, True]:
        for i in range(rows - 1):
            for j in range(width_samples - 1):
                a = int(back) * count + i * width_samples + j
                face = (a, a + 1, a + width_samples + 1, a + width_samples)
                faces.append(tuple(reversed(face)) if back else face)
    boundary = list(range(width_samples))
    boundary += [i * width_samples + width_samples - 1 for i in range(1, rows)]
    boundary += [(rows - 1) * width_samples + j for j in range(width_samples - 2, -1, -1)]
    boundary += [i * width_samples for i in range(rows - 2, 0, -1)]
    for i, a in enumerate(boundary):
        b = boundary[(i + 1) % len(boundary)]
        faces.append((a, a + count, b + count, b))
    return mesh(name, vertices, faces)


def main_path():
    points = []
    # Continuous lower and upper volutes unwind into the same broad sheet.
    # The radial step exceeds the sheet thickness, so the spiral cannot touch
    # itself. Closed side walls give every visible curl real stone depth.
    for i in range(77):
        fraction = i / 76
        angle = math.tau * fraction
        radius = .105 + .145 * fraction
        points.append(Vector((0, -.225 + radius * math.cos(angle), -1.15 + radius * math.sin(angle))))
    for i in range(1, 121):
        t = i / 120
        points.append(Vector((0, .025 + .04 * t + .06 * math.sin(math.pi * t), -1.15 + 2.28 * t)))
    for i in range(1, 85):
        fraction = i / 84
        angle = math.tau * fraction
        radius = .265 - .16 * fraction
        points.append(Vector((0, -.20 + radius * math.cos(angle), 1.13 + radius * math.sin(angle))))
    return points


def build_main_scroll():
    curve = main_path()
    columns = 92
    points = []
    for i, center in enumerate(curve):
        tangent = (curve[min(i + 1, len(curve) - 1)] - curve[max(0, i - 1)]).normalized()
        normal = Vector((0, tangent.z, -tangent.y)).normalized()
        row = []
        # Asymmetry gives the sculpture a new silhouette rather than a plain
        # rectangular plaque. The upper scroll is broader than the lower curl.
        height = min(1, max(0, (center.z + 1.25) / 2.5))
        half_width = .85 + .29 * height
        for j in range(columns):
            u = -1 + 2 * j / (columns - 1)
            x = u * half_width
            twist = .075 * x * center.z
            wave = .045 * u * u + .018 * math.sin(u * 4 + center.z * 2)
            p = center + Vector((x, wave, twist))
            # Shallow inscription: interrupted horizontal scored strokes in
            # the lower open sheet. All lettering detail is geometry, with no
            # bitmap, UV or font dependency in the runtime model.
            if 77 <= i <= 196:
                for line, z in enumerate([-.31, -.43, -.55, -.67, -.79]):
                    length = .50 if line % 2 == 0 else .39
                    if abs(x + .05) < length:
                        p += normal * (.008 * math.exp(-((center.z - z) / .006) ** 2))
            row.append((p, normal))
        points.append(row)
    return closed_sheet("Oracle — broad unfurled stone scroll with spiral volutes", points, columns, .052)


def catmull(points, t):
    position = t * (len(points) - 1)
    index = min(len(points) - 2, int(position))
    q = position - index
    a = points[max(0, index - 1)]
    b, c = points[index], points[index + 1]
    d = points[min(len(points) - 1, index + 2)]
    return .5 * ((2 * b) + (-a + c) * q + (2 * a - 5 * b + 4 * c - d) * q * q
                 + (-a + 3 * b - 3 * c + d) * q * q * q)


def build_messenger_ribbon():
    # A second broad sheet sweeps from the grounded lower coil around the right
    # side. The two scrolls form a sculptural body; there is no bust pedestal.
    guide = [Vector(p) for p in [
        (-.40, -.18, -1.38), (-.94, -.22, -1.26), (-1.17, -.23, -.89),
        (-.85, -.26, -.61), (-.14, -.29, -.82), (.54, -.20, -.81),
        (1.06, -.10, -.48), (1.17, .12, .10), (.99, .17, .54),
    ]]
    rows, columns = 172, 28
    points = []
    for i in range(rows):
        t = i / (rows - 1)
        center = catmull(guide, t)
        tangent = (catmull(guide, min(1, t + .0005)) - catmull(guide, max(0, t - .0005))).normalized()
        side = Vector((tangent.z, 0, -tangent.x)).normalized()
        normal = tangent.cross(side).normalized()
        width = .33 + .075 * math.sin(math.pi * t)
        row = []
        for j in range(columns):
            u = -1 + 2 * j / (columns - 1)
            # A concave edge and slightly rolled surface emphasize its carved
            # cross section under grazing light without decorative clutter.
            p = center + side * (u * width / 2) + normal * (.019 * u * u)
            row.append((p, normal))
        points.append(row)
    return closed_sheet("Oracle — sweeping messenger scroll ribbon", points, columns, .047)


def prepare():
    source = HERE / "coach.blend"
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    portrait = coach.study_object()
    scroll = build_main_scroll()
    mask = build_mask(portrait, scroll)
    preserved = coach.collection("Oracle — accepted portrait reference")
    coach.move_to(portrait, preserved)
    preserved.hide_render = True
    preserved.hide_viewport = True
    build_messenger_ribbon()
    components = {}
    for part in PARTS:
        topology = coach.topology_report(part)
        if topology["nonmanifold_edges"] or topology["signed_volume"] <= 0:
            raise RuntimeError(f"Invalid closed component {part.name}: {topology}")
        coordinates = np.array([vertex.co[:] for vertex in part.data.vertices])
        topology["height"] = float(coordinates[:, 2].max() - coordinates[:, 2].min())
        components[part.name] = topology
    bpy.ops.object.select_all(action="DESELECT")
    for part in PARTS:
        part.select_set(True)
    bpy.context.view_layer.objects.active = mask
    bpy.ops.object.join()
    obj = mask
    obj.name = "The messenger oracle — marble mask and unfurling scrolls"
    # Normalize this new silhouette independently, retaining the common series
    # scale and Y-up export contract without changing the accepted coach file.
    points = np.array([vertex.co[:] for vertex in obj.data.vertices])
    low, high = points.min(axis=0), points.max(axis=0)
    points = (points - (low + high) / 2) * (3 / (high[2] - low[2]))
    obj.data.vertices.foreach_set("co", points.ravel())
    for attr in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attr)
    obj.data.materials.clear()
    obj.data.materials.append(coach.marble_material())
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    obj["attribution"] = COPYRIGHT
    for text in list(bpy.data.texts):
        if text.name.startswith("SOURCE AND LICENSE"):
            bpy.data.texts.remove(text)
    bpy.data.texts.new("SOURCE AND LICENSE").write(COPYRIGHT)
    bpy.context.scene.camera.data.ortho_scale = 3.65
    return obj, source_hash, components


def export(obj):
    material = obj.data.materials[0]
    runtime = bpy.data.materials.new("Messenger oracle — ivory marble with vertex cavities")
    runtime.use_nodes = True
    runtime.diffuse_color = material.diffuse_color
    runtime.use_backface_culling = True
    surface = runtime.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = runtime.diffuse_color
    surface.inputs["Roughness"].default_value = .56
    surface.inputs["Metallic"].default_value = 0
    obj.data.materials[0] = runtime
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(OUT / "subscribe.glb"), export_format="GLB", use_selection=True,
            export_yup=True, export_texcoords=False, export_normals=True, export_materials="EXPORT",
            export_vertex_color="ACTIVE", export_cameras=False, export_lights=False,
            export_animations=False, export_attributes=False, export_copyright=COPYRIGHT,
        )
    finally:
        obj.data.materials[0] = material
        bpy.data.materials.remove(runtime)


def main():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review-only", action="store_true")
    parser.add_argument("--quick", action="store_true")
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "marble-messenger-oracle")
    options = parser.parse_args(args)
    obj, source_hash, components = prepare()
    if options.quick:
        bpy.context.scene.render.resolution_x = 660
        bpy.context.scene.render.resolution_y = 780
    topology = coach.topology_report(obj)
    if topology["nonmanifold_edges"] or topology["signed_volume"] <= 0:
        raise RuntimeError(f"Non-manifold or reversed sculpture: {topology}")
    colors = coach.bake_cavity(obj)
    coach.render_review(options.preview_dir)
    coach.save_study(HERE / "subscribe.blend")
    if not options.review_only:
        export(obj)
        encoder = shutil.which("cwebp")
        if not encoder:
            raise RuntimeError("cwebp is required for transparent fallback packaging.")
        subprocess.run([
            encoder, "-quiet", "-q", "86", "-alpha_q", "100", "-m", "6",
            str(options.preview_dir / "three-quarter.png"), "-o", str(OUT / "subscribe.webp"),
        ], check=True)
    if hashlib.sha256((HERE / "coach.blend").read_bytes()).hexdigest() != source_hash:
        raise RuntimeError("The accepted coaching source was modified.")
    report = {
        "coach_blend_sha256_unchanged": source_hash,
        "modifications": "Facial anatomy resampled into a small closed mask with a flared border and continuous rear support attached to the main scroll; head, neck, shoulders and chest omitted; two original thick curled scrolls form the new sculpture.",
        "components_before_composition_normalization": components,
        "export": topology, "linear_cavity": colors, "copyright": COPYRIGHT,
    }
    (HERE / "sources/subscribe-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print("MESSENGER_ORACLE_STUDY", json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
