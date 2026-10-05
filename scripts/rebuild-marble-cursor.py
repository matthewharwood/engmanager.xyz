"""Sculpt God's right-hand gesture from Michelangelo's Creation of Adam.

Original anatomy lofts, unified stone surface, carved nails/folds and a closed
wrist cut. Preserve the detailed source independently of the browser copy.
Run Blender --background --factory-startup --python-exit-code 1 --python <file>.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "_docs/cursors"
ASSETS = ROOT / "website/assets/cursors/v1"
sys.path.insert(0, str(ROOT / "scripts/journey-posters"))
import rebuild_coach as studio

PROVENANCE = ("Original Blender sculpture for engmanager.xyz (2026), after God's right hand "
              "in Michelangelo's public-domain Creation of Adam. No reused 3D geometry. "
              "Reference and anatomical photograph credits: _docs/cursors/README.md.")


def active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def spline(values, steps=12):
    result = []
    for i in range(len(values) - 1):
        a, b, c, d = [np.array(values[min(len(values) - 1, max(0, j))], dtype=float) for j in (i - 1, i, i + 1, i + 2)]
        for k in range(steps):
            t = k / steps
            result.append(.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t
                                + (-a + 3 * b - 3 * c + d) * t * t * t))
    result.append(np.array(values[-1], dtype=float))
    return result


def loft(name, sections, palm=False):
    path = spline(sections)
    vertices, faces = [], []
    radial = 40
    for i, section in enumerate(path):
        center = Vector(section[:3])
        tangent = Vector(path[min(i + 1, len(path) - 1)][:3]) - Vector(path[max(0, i - 1)][:3])
        tangent.normalize()
        side = Vector((0, 1, 0)) if palm else Vector((-tangent.y, tangent.x, 0)).normalized()
        depth = tangent.cross(side).normalized()
        if depth.z < 0:
            depth = -depth
        for j in range(radial):
            angle = j * 2 * math.pi / radial
            c, s = math.cos(angle), math.sin(angle)
            if palm:
                c = math.copysign(abs(c) ** .82, c)
                s = math.copysign(abs(s) ** .86, s)
            point = center + side * c * max(.003, section[3]) + depth * s * max(.003, section[4])
            vertices.append(point)
    for i in range(len(path) - 1):
        for j in range(radial):
            a, b = i * radial + j, i * radial + (j + 1) % radial
            faces.append((a, b, b + radial, a + radial))
    faces.extend([tuple(reversed(range(radial))), tuple(range((len(path) - 1) * radial, len(path) * radial))])
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    return obj


def original_anatomy():
    parts = [loft("Palm — dorsal plane, thenar saddle and narrow wrist", [
        (1.15, -.08, -.10, .01, .01), (1.28, -.10, -.09, .24, .20),
        (1.42, -.13, -.07, .42, .28),
        (1.74, -.09, -.02, .54, .33), (2.05, .03, -.015, .48, .34),
        (2.30, .14, -.03, .38, .285), (2.64, .20, -.05, .36, .245),
        (2.82, .21, -.06, .35, .24),
    ], palm=True)]
    fingers = {
        "Index — leftward reaching fingertip": [
            (1.78, .065, -.02, .03, .03),
            (1.49, .055, -.035, .20, .16), (1.20, .085, -.01, .17, .145),
            (.93, .11, .005, .14, .12), (.65, .11, .01, .125, .108),
            (.35, .075, .015, .105, .09), (.14, .015, .015, .077, .07),
            (.045, -.005, .012, .052, .05), (.002, -.012, .012, .003, .003),
        ],
        "Thumb — diagonal across the relaxed fingers": [
            (2.24, .03, .02, .03, .03),
            (2.00, -.08, .08, .23, .22), (1.77, -.21, .23, .205, .18),
            (1.48, -.38, .34, .17, .15), (1.17, -.51, .365, .145, .13),
            (.95, -.55, .36, .125, .11), (.84, -.52, .34, .055, .065),
            (.82, -.49, .33, .003, .003),
        ],
        "Middle — longest relaxed curl": [
            (1.98, -.15, -.08, .03, .03),
            (1.72, -.36, -.12, .185, .155), (1.46, -.59, -.14, .17, .14),
            (1.13, -.76, -.13, .145, .125), (1.035, -.94, -.12, .12, .115),
            (1.06, -1.13, -.07, .102, .09), (1.09, -1.18, -.03, .035, .045),
            (1.10, -1.23, -.02, .003, .003),
        ],
        "Ring — staggered behind the middle": [
            (2.22, -.15, -.14, .03, .03),
            (1.99, -.40, -.25, .175, .15), (1.72, -.58, -.26, .15, .13),
            (1.42, -.73, -.24, .125, .11), (1.35, -.92, -.23, .105, .09),
            (1.35, -1.11, -.18, .083, .08), (1.38, -1.15, -.14, .027, .033),
            (1.39, -1.19, -.13, .003, .003),
        ],
        "Little — short outer curl": [
            (2.36, -.05, -.18, .03, .03),
            (2.13, -.34, -.34, .15, .13), (1.96, -.53, -.36, .13, .11),
            (1.77, -.71, -.35, .105, .092), (1.67, -.92, -.31, .087, .08),
            (1.70, -1.03, -.27, .062, .06), (1.72, -1.08, -.255, .003, .003),
        ],
    }
    parts.extend(loft(name, points) for name, points in fingers.items())
    for name, position, scale in [
        ("Middle — continuous rounded fingertip pad", (1.068, -1.12, -.06), (.108, .15, .115)),
        ("Ring — continuous rounded fingertip pad", (1.355, -1.08, -.17), (.095, .135, .107)),
        ("Little — continuous rounded fingertip pad", (1.70, -1.0, -.27), (.080, .110, .087)),
    ]:
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, location=position)
        pad = bpy.context.object
        pad.name = name
        pad.scale = scale
        active(pad)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        parts.append(pad)
    # Volumetric fusion gives the webbing real continuous anatomy, with no
    # floating finger blocks, accessories or disconnected fingernail shells.
    active(parts[0])
    for part in parts:
        part.select_set(True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "Creation — preserved detailed hand"
    modifier = obj.modifiers.new("Continuous anatomical surface", "REMESH")
    modifier.mode = "VOXEL"
    modifier.voxel_size = .008
    modifier.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new("Honed sculpted transitions", "SMOOTH")
    modifier.factor = .72
    modifier.iterations = 5
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def distance_segment(p, a, b):
    d = b - a
    t = max(0, min(1, (p - a).dot(d) / d.length_squared))
    return (p - (a + d * t)).length, t


def carve_detail(obj):
    # Actual shallow relief, rather than a painted nail or stock skin texture.
    # Detail is understated in the same way as the journey marble sculptures.
    tendons = [((2.62, .35), (1.41, .14), .018, .044),
               ((2.61, .22), (1.55, -.11), .014, .050),
               ((2.56, .08), (1.67, -.34), .012, .044)]
    creases = [((.63, .20), (.66, .03), .009, .010),
               ((.96, .235), (.99, .015), .012, .011),
               ((1.22, .26), (1.27, .01), .014, .012),
               ((1.43, -.32), (1.50, -.49), .010, .012),
               ((1.04, -.86), (1.20, -.90), .009, .010),
               ((1.28, -.87), (1.44, -.90), .008, .010),
               ((2.52, -.12), (2.55, .39), .008, .012)]
    tendons = [(Vector(a), Vector(b), amplitude, width) for a, b, amplitude, width in tendons]
    creases = [(Vector(a), Vector(b), amplitude, width) for a, b, amplitude, width in creases]
    nails = [(.255, .066, .11, .053, -.12, .070),
             (.992, -.54, .11, .076, -.34, .42)]
    for vertex in obj.data.vertices:
        p = vertex.co
        if vertex.normal.z < .25:
            continue
        xy = Vector((p.x, p.y))
        relief = 0
        if 1.32 < p.x < 2.68 and p.z > .12:
            for a, b, amplitude, width in tendons:
                distance, t = distance_segment(xy, a, b)
                relief += amplitude * math.exp(-(distance / width) ** 2) * math.sin(math.pi * t) ** .6
        for a, b, amplitude, width in creases:
            distance, t = distance_segment(xy, a, b)
            relief -= amplitude * math.exp(-(distance / width) ** 2) * math.sin(math.pi * t) ** .5
        for x, y, rx, ry, angle, threshold in nails:
            if p.z < threshold:
                continue
            dx, dy = p.x - x, p.y - y
            u = (dx * math.cos(angle) + dy * math.sin(angle)) / rx
            v = (-dx * math.sin(angle) + dy * math.cos(angle)) / ry
            r = math.hypot(u, v)
            relief += .008 * math.exp(-(r / .84) ** 4) - .012 * math.exp(-((r - 1) / .095) ** 2)
        p.z += relief * min(1, (vertex.normal.z - .25) / .4)
    # Bisect at the anatomical wrist. Close and recalculate its stone cut face.
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.bisect_plane(bm, geom=list(bm.verts) + list(bm.edges) + list(bm.faces),
        dist=.000001, plane_co=(2.64, 0, 0), plane_no=(1, 0, 0), clear_outer=True)
    edges = [edge for edge in bm.edges if edge.is_boundary]
    bmesh.ops.holes_fill(bm, edges=edges, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    for face in obj.data.polygons:
        face.use_smooth = abs(face.normal.x) < .999 or face.center.x < 2.639


def make_export(source):
    preserved = studio.collection("Creation — preserved detailed anatomy")
    studio.move_to(source, preserved)
    obj = bpy.data.objects.new("Creation — compact marble cursor", source.data.copy())
    studio.collection("Creation — browser export").objects.link(obj)
    active(obj)
    modifier = obj.modifiers.new("Independent export simplification", "DECIMATE")
    modifier.ratio = .085
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Anchor an actual index-tip vertex, including through the Grip morph.
    anchor = min(obj.data.vertices, key=lambda v: (v.co.x, abs(v.co.y), abs(v.co.z)))
    tip = anchor.co.copy()
    for vertex in obj.data.vertices:
        vertex.co -= tip
    for vertex in source.data.vertices:
        vertex.co -= tip
    obj.data.update()
    material = studio.marble_material()
    material.name = "Creation — high-key honed white marble"
    material.diffuse_color = (.80, .79, .76, 1)
    material.node_tree.nodes.get("Principled BSDF").inputs["Base Color"].default_value = material.diffuse_color
    obj.data.materials.append(material)
    source_material = material.copy()
    source_material.name = "Creation — preserved anatomy marble"
    source.data.materials.append(source_material)
    preserved.hide_viewport = preserved.hide_render = True
    source.hide_set(True)
    obj["provenance"] = source["provenance"] = PROVENANCE
    return obj, anchor.index


def grip(obj, anchor):
    obj.shape_key_add(name="Basis")
    key = obj.shape_key_add(name="Grip")
    # A small flex keeps the iconic pointing silhouette. The index and its
    # contact vertex stay fixed, while the three curled digits close in depth.
    for i, vertex in enumerate(key.data):
        p = vertex.co
        if p.y < -.65 and p.x > .86:
            weight = min(1, (-p.y - .65) / .45)
            p.z += .09 * weight
            p.y += .035 * weight
        elif .8 < p.x < 1.55 and p.y < -.28 and p.z > .22:
            p.z -= .035 * min(1, (1.55 - p.x) / .5)
    key.data[anchor].co = obj.data.shape_keys.key_blocks["Basis"].data[anchor].co


def export(obj, name):
    active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    mat = obj.data.materials[0]
    runtime = bpy.data.materials.new("Honed white marble — cavity factor")
    runtime.use_nodes = True
    runtime.diffuse_color = mat.diffuse_color
    surface = runtime.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = runtime.diffuse_color
    surface.inputs["Roughness"].default_value = .56
    runtime.use_backface_culling = True
    obj.data.materials[0] = runtime
    try:
        bpy.ops.export_scene.gltf(filepath=str(ASSETS / name), export_format="GLB", use_selection=True,
            export_yup=False, export_texcoords=False, export_normals=True, export_tangents=False,
            export_materials="EXPORT", export_vertex_color="ACTIVE", export_animations=False,
            export_skins=False, export_morph=True, export_morph_normal=True,
            export_try_sparse_sk=False, export_try_omit_sparse_sk=False,
            export_cameras=False, export_lights=False, export_extras=False, export_copyright=PROVENANCE)
    finally:
        obj.data.materials[0] = mat
        bpy.data.materials.remove(runtime)
    raw = (ASSETS / name).read_bytes()
    length, _ = struct.unpack_from("<II", raw, 12)
    data = json.loads(raw[20:20 + length])
    assert not data.get("extensionsRequired")
    for node in data["nodes"]:
        assert not any(k in node for k in ("matrix", "translation", "rotation", "scale"))
    return {"bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "triangles": sum(data["accessors"][p["indices"]]["count"] // 3
        for mesh in data["meshes"] for p in mesh["primitives"])}


def setup_studio():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 760
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    scene.world = bpy.data.worlds.new("Soft white gallery")
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (.30, .32, .36, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = .6
    target = Vector((1.25, -.29, 0))
    bpy.ops.object.camera_add(location=target + Vector((0, 0, 8)))
    scene.camera = bpy.context.object
    scene.camera.data.type = "ORTHO"
    scene.camera.data.ortho_scale = 3.4
    for name, location, energy, size in [
        ("Large white sculpting key", (-1.5, 3.2, 5), 500, 3),
        ("Soft gallery fill", (3, -1, 4), 160, 4),
        ("Stone edge", (2, 2, -3), 240, 3),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        studio.aim(light, target)
    return target


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path, default=Path("/tmp/engmanager-marble-hand-review/blender"))
    parser.add_argument("--study-only", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    source = original_anatomy()
    carve_detail(source)
    obj, anchor = make_export(source)
    reports = {"source": studio.topology_report(source), "export": studio.topology_report(obj)}
    for report in reports.values():
        assert report["boundary_edges"] == report["nonmanifold_edges"] == 0, report
        assert len(report["island_vertex_counts"]) == 1 and report["signed_volume"] > 0, report
    target = setup_studio()
    args.preview_dir.mkdir(parents=True, exist_ok=True)
    DOCS.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)
    # Review the silhouette and anatomical depth before material baking/export.
    for name, offset in [("front", (0, 0, 8)), ("profile", (0, -8, .7)),
                          ("three-quarter", (2.8, -2.5, 8)), ("back", (0, 0, -8))]:
        bpy.context.scene.camera.location = target + Vector(offset)
        studio.aim(bpy.context.scene.camera, target)
        bpy.context.scene.render.filepath = str(args.preview_dir / (name + ".png"))
        bpy.ops.render.render(write_still=True)
    bpy.context.scene.camera.location = target + Vector((0, 0, 8))
    studio.aim(bpy.context.scene.camera, target)
    reports["provenance"] = PROVENANCE
    reports["anchor_vertex"] = anchor
    if not args.study_only:
        reports["cavity"] = studio.bake_cavity(obj)
        grip(obj, anchor)
        reports["asset"] = export(obj, "hand.glb")
    active(obj)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region = area.spaces.active.region_3d
                region.view_location = target
                region.view_distance = 4
                region.view_rotation = bpy.context.scene.camera.rotation_euler.to_quaternion()
    text = bpy.data.texts.new("CREATION HAND — SOURCE AND REFERENCES")
    text.write(PROVENANCE + "\nRebuild: scripts/rebuild-marble-cursor.py\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(DOCS / "creation-hand.blend"), compress=True)
    (args.preview_dir / "validation.json").write_text(json.dumps(reports, indent=2) + "\n")
    if not args.study_only:
        (DOCS / "creation-hand-validation.json").write_text(json.dumps(reports, indent=2) + "\n")
    print("MARBLE_HAND_BUILD_COMPLETE " + json.dumps(reports))


if __name__ == "__main__":
    main()
