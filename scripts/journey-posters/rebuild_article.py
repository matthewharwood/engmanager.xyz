"""Build an original open marble folio for the next-article journey poster.

The thick curved leaves, scored page faces, covers and rising turned leaf are
original procedural geometry. No scan or third-party model is used. The full
authoring mesh stays hidden beside a separately simplified, shaded export copy.
"""

import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import bmesh
import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebuild_coach as studio

SOURCE_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = SOURCE_DIR.parents[1] / "website/assets/journey"
COPYRIGHT = (
    "The Open Folio — original procedural sculpture for engmanager.xyz, 2026. "
    "Authored in Blender: layered curved stone pages, two covers, a rounded "
    "binding and one rising turned leaf. No third-party geometry. "
    "Shared honed ivory material and portrait studio from the journey series."
)


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def closed_leaf(name, surface, thickness, collection, rows=104, columns=104):
    """Sample a two-sided thick page, closing all four edges explicitly."""
    vertices = []
    faces = []
    stride = columns + 1
    count = (rows + 1) * stride
    for rear in (False, True):
        for row in range(rows + 1):
            for column in range(columns + 1):
                u, v = column / columns, row / rows
                point = surface(u, v)
                # Thickness is on the depth axis, rather than a zero-thickness
                # double-sided glTF plane. Every page has a real visible edge.
                vertices.append((point[0], point[1] + (thickness if rear else 0), point[2]))
    for row in range(rows):
        for column in range(columns):
            a = row * stride + column
            b = a + 1
            c = b + stride
            d = a + stride
            faces.extend([(a, b, c, d), (d + count, c + count, b + count, a + count)])
    perimeter = list(range(stride))
    perimeter += [row * stride + columns for row in range(1, rows + 1)]
    perimeter += [rows * stride + column for column in range(columns - 1, -1, -1)]
    perimeter += [row * stride for row in range(rows - 1, 0, -1)]
    for a, b in zip(perimeter, perimeter[1:] + perimeter[:1]):
        faces.append((b, a, a + count, b + count))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.calc_volume(signed=True) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    for face in mesh.polygons:
        face.use_smooth = True
    report = studio.topology_report(obj)
    if report["boundary_edges"] or report["nonmanifold_edges"] or report["signed_volume"] <= 0:
        raise RuntimeError(f"Page is not a closed outward-facing solid: {name}: {report}")
    return obj


def page_surface(sign, layer=0, cover=False):
    width = 1.19 if cover else 1.105 - layer * 0.009
    height = 2.50 if cover else 2.36 - layer * 0.007
    # The cover sits behind the leaves; the small fanning offsets remain visible
    # at the fore edge while every inner margin intersects the stone binding.
    depth = 0.25 if cover else 0.18 - layer * 0.029

    def surface(u, v):
        x = sign * (0.035 + width * u)
        z = (v - 0.5) * height + 0.035 * math.sin(math.pi * u)
        z += sign * 0.045 * u + (0.025 if sign < 0 else -0.025) * math.sin(math.pi * v) * u
        y = depth - 0.30 * math.sin(math.pi * u * 0.82) - 0.13 * u
        # Quiet chisel marks on the exposed pages read as paragraph blocks,
        # without presenting fake legible text as editorial content.
        if layer == 7 and not cover:
            for row in range(15):
                center = 0.18 + row * 0.044
                endpoint = (0.80, 0.86, 0.65, 0.88, 0.76)[row % 5]
                if 0.16 < u < endpoint:
                    fade = min(1, (u - 0.16) * 35, (endpoint - u) * 35)
                    y += 0.011 * fade * math.exp(-((v - center) / 0.0045) ** 2)
            # A shallow ornamental title panel gives the page a crafted face.
            if 0.25 < u < 0.75:
                y += 0.008 * math.exp(-((v - 0.88) / 0.013) ** 2)
        return x, y, z

    return surface


def turning_surface(u, v):
    # A single leaf rises from the gutter and arches toward the viewer. Its
    # free outer edge twists back, creating a recognisable page-turn silhouette
    # from the front and profile rather than another portrait with an accessory.
    x = 0.035 + 0.94 * math.sin(math.pi * u * 0.86)
    y = -0.035 - 0.90 * math.sin(math.pi * u * 0.68)
    z = (v - 0.5) * 2.28 + 0.53 * u ** 1.35
    x += 0.13 * u * math.sin(math.pi * v)
    y += 0.16 * u ** 2 * math.cos(math.pi * v)
    return x, y, z


def make_source():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    original = studio.collection("Article — preserved detailed folio")
    parts = []
    for sign, side in ((-1, "Left"), (1, "Right")):
        parts.append(closed_leaf(f"{side} curved stone cover", page_surface(sign, cover=True), 0.075, original))
        for layer in range(8):
            parts.append(closed_leaf(f"{side} folio leaf {layer + 1}", page_surface(sign, layer), 0.018, original))
    parts.append(closed_leaf("Rising turned stone leaf", turning_surface, 0.027, original, rows=132, columns=132))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=80, location=(0, 0.13, 0))
    binding = bpy.context.object
    binding.name = "Rounded carved folio binding"
    binding.scale = (0.092, 0.19, 1.255)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    studio.move_to(binding, original)
    for face in binding.data.polygons:
        face.use_smooth = True
    parts.append(binding)
    component_reports = {part.name: studio.topology_report(part) for part in parts}
    # Source geometry is deliberately retained at full sampling density. Leaves
    # are separately closed solids, meeting at the binding; no detached scraps.
    points = [vertex.co for part in parts for vertex in part.data.vertices]
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    center = (low + high) / 2
    scale = 3 / (high.z - low.z)
    for part in parts:
        for vertex in part.data.vertices:
            vertex.co = (vertex.co - center) * scale
        part["provenance"] = COPYRIGHT
    display = studio.collection("Article — simplified marble study")
    copies = []
    export_components = {}
    for part in parts:
        copy = bpy.data.objects.new(part.name + " — export copy", part.data.copy())
        display.objects.link(copy)
        activate(copy)
        modifier = copy.modifiers.new("Separate lightweight export surface", "DECIMATE")
        modifier.ratio = 0.19 if "leaf" in part.name else 0.28
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        report = studio.topology_report(copy)
        if (report["boundary_edges"] or report["nonmanifold_edges"] or
                report["signed_volume"] <= 0 or len(report["island_vertex_counts"]) != 1):
            raise RuntimeError(f"Simplification damaged a folio solid: {part.name}: {report}")
        export_components[part.name] = report
        copies.append(copy)
    bpy.ops.object.select_all(action="DESELECT")
    for part in copies:
        part.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    final = bpy.context.object
    final.name = "Article — The Open Folio"
    final.data.materials.clear()
    final.data.materials.append(studio.marble_material())
    final["attribution"] = COPYRIGHT
    final["construction"] = "20 intentionally closed parts, interlocked at the central binding; no detached fragments."
    original.hide_viewport = True
    original.hide_render = True
    for part in parts:
        part.hide_set(True)
    return final, component_reports, export_components


def export(obj):
    material = obj.data.materials[0]
    runtime = bpy.data.materials.new("Article — honed ivory marble with vertex cavities")
    runtime.use_nodes = True
    runtime.diffuse_color = (0.62, 0.60, 0.56, 1)
    surface = runtime.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = runtime.diffuse_color
    surface.inputs["Roughness"].default_value = 0.56
    surface.inputs["Metallic"].default_value = 0
    runtime.use_backface_culling = True
    obj.data.materials[0] = runtime
    activate(obj)
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(RUNTIME_DIR / "article.glb"), export_format="GLB",
            use_selection=True, export_yup=True, export_texcoords=False,
            export_normals=True, export_materials="EXPORT", export_vertex_color="ACTIVE",
            export_cameras=False, export_lights=False, export_animations=False,
            export_attributes=False, export_copyright=COPYRIGHT,
        )
    finally:
        obj.data.materials[0] = material
        bpy.data.materials.remove(runtime)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review-only", action="store_true")
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "article-study/final")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    obj, components, export_components = make_source()
    report = studio.topology_report(obj)
    if report["boundary_edges"] or report["nonmanifold_edges"] or report["signed_volume"] <= 0:
        raise RuntimeError(f"Invalid export topology: {report}")
    if len(report["island_vertex_counts"]) != len(components):
        raise RuntimeError("Simplification introduced a disconnected leaf fragment.")
    studio.setup_studio()
    cavity = studio.bake_cavity(obj)
    studio.render_review(args.preview_dir)
    bpy.context.scene.camera.location = (4.1, -8, 0.4)
    studio.aim(bpy.context.scene.camera)
    activate(obj)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region = area.spaces.active.region_3d
                region.view_distance = 5
                region.view_location = (0, 0, 0)
                region.view_rotation = bpy.context.scene.camera.rotation_euler.to_quaternion()
    text = bpy.data.texts.new("ARTICLE SOURCE AND PROVENANCE")
    text.write(COPYRIGHT + "\n\nOriginal procedural geometry. Source script: rebuild_article.py.\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR / "article.blend"), compress=True)
    if not args.review_only:
        RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
        export(obj)
        encoder = shutil.which("cwebp")
        if not encoder:
            raise RuntimeError("cwebp is required to package the article fallback.")
        subprocess.run([encoder, "-quiet", "-q", "86", "-alpha_q", "100", "-m", "6",
                        str(args.preview_dir / "three-quarter.png"), "-o", str(RUNTIME_DIR / "article.webp")], check=True)
    result = {"source": "Original procedural geometry: rebuild_article.py", "copyright": COPYRIGHT,
              "intentional_closed_components": components, "simplified_closed_components": export_components,
              "export": report, "linear_cavity": cavity,
              "source_preserved": True, "export_simplified_separately": True}
    (SOURCE_DIR / "sources/article-validation.json").write_text(json.dumps(result, indent=2) + "\n")
    print("ARTICLE_STUDY", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
