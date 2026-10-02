"""Carve a folded correspondence letter onto the accepted marble portrait.

Reads coach.blend without changing its portrait or source geometry. The letter
has an outward-facing closed surface, modeled folds and an original seal. Run
with Blender 5.1+ and --python-exit-code 1; use --review-only to render studies
before replacing the runtime assets.
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
HALF_WIDTH, HALF_HEIGHT = .76, .275
ROLL = math.radians(3)
COPYRIGHT = (
    'Adapted from "Aristotele bust" by nicola_scaramella. '
    'https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930 '
    'Licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. '
    'Changes: orientation, normalization, restrained relief enhancement, export '
    'decimation, marble material, vertex cavity shading, and an original carved '
    'folded correspondence letter with envelope folds and a star seal. '
    'The accepted coaching portrait and its source remain unchanged.'
)


def mesh(name, vertices, faces, smooth=True):
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
        face.use_smooth = smooth
    PARTS.append(obj)
    return obj


def distance_to_segment(point, start, end):
    point, start, end = Vector(point), Vector(start), Vector(end)
    segment = end - start
    fraction = min(1, max(0, (point - start).dot(segment) / segment.length_squared))
    return (point - start - segment * fraction).length


def letter_depth(u, v, relief=True):
    # The lower edge rests against the bust's cropped base; the upper edge
    # recedes into the chest behind the existing beard. This is a shallow carved
    # stone relief, rather than a floating paper prop or invented human hands.
    depth = -.16 + .61 * v + .24 * u * u
    if relief:
        folds = [
            ((-HALF_WIDTH, HALF_HEIGHT), (0, -.045)),
            ((HALF_WIDTH, HALF_HEIGHT), (0, -.045)),
            ((-HALF_WIDTH, -HALF_HEIGHT), (0, .025)),
            ((HALF_WIDTH, -HALF_HEIGHT), (0, .025)),
        ]
        distance = min(distance_to_segment((u, v), start, end) for start, end in folds)
        depth += .009 * math.exp(-(distance / .006) ** 2)
        # The folded paper is represented as softly honed stone; no noise
        # displacement is applied to the accepted facial anatomy.
        depth += .0014 * math.sin(u * 14 + v * 9) * math.sin(v * 17)
    return depth


def point(u, v, depth):
    return Vector((u * math.cos(ROLL) - v * math.sin(ROLL), depth,
                   -1.12 + u * math.sin(ROLL) + v * math.cos(ROLL)))


def build_letter():
    columns, rows = 168, 78
    vertices, faces = [], []
    count = (columns + 1) * (rows + 1)
    for back in [False, True]:
        for i in range(rows + 1):
            v = -HALF_HEIGHT + 2 * HALF_HEIGHT * i / rows
            for j in range(columns + 1):
                u = -HALF_WIDTH + 2 * HALF_WIDTH * j / columns
                depth = letter_depth(u, v, not back)
                if back:
                    # The rear lies within the torso; only the fine folded edge
                    # projects in side view. The overlapping pieces remain
                    # independently watertight rather than voxel-remeshing the
                    # face and losing the scan's accepted sculptural detail.
                    depth += .175
                else:
                    edge = min(HALF_WIDTH - abs(u), HALF_HEIGHT - abs(v))
                    depth += .009 * math.exp(-(edge / .009) ** 2)
                vertices.append(tuple(point(u, v, depth)))
        for i in range(rows):
            for j in range(columns):
                a = int(back) * count + i * (columns + 1) + j
                face = (a, a + 1, a + columns + 2, a + columns + 1)
                faces.append(tuple(reversed(face)) if back else face)
    boundary = list(range(columns + 1))
    boundary += [i * (columns + 1) + columns for i in range(1, rows + 1)]
    boundary += [rows * (columns + 1) + j for j in range(columns - 1, -1, -1)]
    boundary += [i * (columns + 1) for i in range(rows - 1, 0, -1)]
    for i, a in enumerate(boundary):
        b = boundary[(i + 1) % len(boundary)]
        faces.append((a, a + count, b + count, b))
    return mesh("Correspondence — carved envelope with recessed folds", vertices, faces)


def build_seal():
    # A deliberately restrained seal ties the envelope folds together. Its
    # scalloped wax-like contour and four-point stamp are all marble geometry.
    u, v = .025, -.032
    origin = point(u, v, letter_depth(u, v) - .008)
    normal = Vector((-math.sin(ROLL) * .61, -1, math.cos(ROLL) * .61)).normalized()
    tangent = Vector((math.cos(ROLL), 0, math.sin(ROLL)))
    vertical = normal.cross(tangent).normalized()
    segments, rings = 96, 12
    vertices = [tuple(origin + normal * .032)]
    for ring in range(1, rings + 1):
        r = ring / rings
        for j in range(segments):
            angle = math.tau * j / segments
            scallop = 1 + .025 * math.sin(angle * 13) + .015 * math.cos(angle * 7)
            radius = .092 * r * scallop
            height = .011 + .021 * max(0, 1 - r * r) ** .6
            if .72 < r < .91:
                height += .005 * math.sin(math.pi * (r - .72) / .19)
            vertices.append(tuple(origin + normal * height + radius * (
                tangent * math.cos(angle) + vertical * math.sin(angle))))
    faces = [(0, 1 + j, 1 + (j + 1) % segments) for j in range(segments)]
    for ring in range(rings - 1):
        for j in range(segments):
            a = 1 + ring * segments + j
            b = 1 + ring * segments + (j + 1) % segments
            faces.append((a, a + segments, b + segments, b))
    back = len(vertices)
    vertices.append(tuple(origin - normal * .009))
    start = 1 + (rings - 1) * segments
    faces += [(back, start + (j + 1) % segments, start + j) for j in range(segments)]
    mesh("Correspondence — scalloped marble seal", vertices, faces)
    # A tiny four-point star echoes the site's minimal geometric vocabulary.
    points = []
    for i in range(8):
        angle = math.pi / 2 + i * math.pi / 4
        radius = .039 if i % 2 == 0 else .011
        points.append(origin + tangent * (math.cos(angle) * radius)
                      + vertical * (math.sin(angle) * radius))
    vertices = [tuple(p + normal * .032) for p in points]
    vertices += [tuple(p + normal * .038) for p in points]
    faces = [tuple(range(7, -1, -1)), tuple(range(8, 16))]
    faces += [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
    star = mesh("Correspondence — four-point seal stamp", vertices, faces, smooth=False)
    bpy.context.view_layer.objects.active = star
    bevel = star.modifiers.new("Soft carved stamp edges", "BEVEL")
    bevel.width = .002
    bevel.segments = 2
    bpy.ops.object.modifier_apply(modifier=bevel.name)


def prepare():
    source = HERE / "coach.blend"
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    obj = coach.study_object()
    obj.name = "The correspondent — newsletter marble study"
    portrait_before = np.array([vert.co[:] for vert in obj.data.vertices])
    PARTS.append(obj)
    build_letter()
    build_seal()
    if not np.array_equal(portrait_before, np.array([vert.co[:] for vert in obj.data.vertices])):
        raise RuntimeError("The accepted portrait geometry was changed.")
    bpy.ops.object.select_all(action="DESELECT")
    for part in PARTS:
        part.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
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
    return obj, source_hash, len(portrait_before)


def export(obj):
    material = obj.data.materials[0]
    runtime = bpy.data.materials.new("Correspondent — ivory marble with vertex cavities")
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
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "aristotle-correspondent")
    options = parser.parse_args(args)
    obj, source_hash, portrait_vertices = prepare()
    if options.quick:
        bpy.context.scene.render.resolution_x = 660
        bpy.context.scene.render.resolution_y = 780
    colors = coach.bake_cavity(obj)
    topology = coach.topology_report(obj)
    if topology["nonmanifold_edges"] or topology["signed_volume"] <= 0:
        raise RuntimeError(f"Non-manifold or reversed sculpture: {topology}")
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
        "portrait_vertices_unchanged": portrait_vertices,
        "export": topology, "linear_cavity": colors, "copyright": COPYRIGHT,
    }
    (HERE / "sources/subscribe-validation.json").write_text(json.dumps(report, indent=2) + "\n")
    print("CORRESPONDENT_STUDY", json.dumps(report), flush=True)


if __name__ == "__main__":
    main()
