"""Author the newsletter's original marble armillary in Blender.

Detailed closed solids are preserved separately from the compact browser copy.
The studio, ivory material and vertex cavity treatment match the journey series.
"""
import argparse
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import bpy
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebuild_coach as studio

SOURCE = Path(__file__).resolve().parent
RUNTIME = SOURCE.parents[1] / "website/assets/newsletter"
COPYRIGHT = ("A Little Perspective — original marble armillary for engmanager.xyz, 2026. "
             "Authored in Blender: a faceted stone globe, four carved orbital bands, "
             "a polar spindle and a turned museum plinth. No third-party geometry. "
             "Shared honed ivory material, studio and vertex cavity shading from the journey series.")


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def make_source():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    original = studio.collection("Armillary — preserved detailed sculpture")
    parts = []
    # Beveled facets catch quiet studio highlights instead of wireframe lines.
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=4, radius=.64, location=(0, 0, .18))
    globe = bpy.context.object
    globe.name = "Faceted carved globe"
    bevel = globe.modifiers.new("Honed facet edges", "BEVEL")
    bevel.width = .0028
    bevel.segments = 3
    bevel.limit_method = "NONE"
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    parts.append(globe)
    # Cross-sections have real volume and rounded edges, including side views.
    for index, (radius, tube, tilt, spin) in enumerate([
        (.88, .038, 62, 15), (1.06, .045, 22, -36),
        (1.24, .029, 78, 28), (1.40, .022, 88, 0),
    ]):
        bpy.ops.mesh.primitive_torus_add(major_segments=384, minor_segments=24,
            major_radius=radius, minor_radius=tube, location=(0, 0, .18),
            rotation=(math.radians(tilt), 0, math.radians(spin)))
        band = bpy.context.object
        band.name = f"Carved orbital band {index + 1}"
        for face in band.data.polygons:
            face.use_smooth = True
        parts.append(band)
    # The spindle and restrained stepped base ground the globe as an object.
    for name, radius, depth, z in [
        ("Polar stone spindle", .045, 2.80, .18),
        ("Turned foot", .19, .12, -1.12),
        ("Upper plinth bevel", .34, .10, -1.23),
        ("Museum plinth", .43, .15, -1.35),
    ]:
        bpy.ops.mesh.primitive_cylinder_add(vertices=192, radius=radius, depth=depth, location=(0, 0, z))
        part = bpy.context.object
        part.name = name
        bevel = part.modifiers.new("Soft stone arris", "BEVEL")
        bevel.width = .008 if name == "Polar stone spindle" else .022
        bevel.segments = 4
        bpy.ops.object.modifier_apply(modifier=bevel.name)
        for face in part.data.polygons:
            face.use_smooth = True
        parts.append(part)
    for part in parts:
        activate(part)
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        studio.move_to(part, original)
    points = [vertex.co for part in parts for vertex in part.data.vertices]
    low = Vector(tuple(min(p[a] for p in points) for a in range(3)))
    high = Vector(tuple(max(p[a] for p in points) for a in range(3)))
    center, scale = (low + high) / 2, 3 / (high.z - low.z)
    display = studio.collection("Armillary — compact marble export")
    source_reports, export_reports, copies = {}, {}, []
    for part in parts:
        for vertex in part.data.vertices:
            vertex.co = (vertex.co - center) * scale
        part["provenance"] = COPYRIGHT
        source_reports[part.name] = studio.topology_report(part)
        copy = bpy.data.objects.new(part.name + " — export copy", part.data.copy())
        display.objects.link(copy)
        activate(copy)
        modifier = copy.modifiers.new("Independent browser simplification", "DECIMATE")
        modifier.ratio = .15 if "band" in part.name else .38
        bpy.ops.object.modifier_apply(modifier=modifier.name)
        report = studio.topology_report(copy)
        if (report["boundary_edges"] or report["nonmanifold_edges"] or
                report["signed_volume"] <= 0 or len(report["island_vertex_counts"]) != 1):
            raise RuntimeError(f"Invalid armillary solid: {part.name}: {report}")
        export_reports[part.name] = report
        copies.append(copy)
    bpy.ops.object.select_all(action="DESELECT")
    for part in copies:
        part.select_set(True)
    bpy.context.view_layer.objects.active = copies[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = "A Little Perspective — marble armillary"
    obj.data.materials.clear()
    obj.data.materials.append(studio.marble_material())
    original.hide_viewport = original.hide_render = True
    for part in parts:
        part.hide_set(True)
    return obj, source_reports, export_reports


def export(obj):
    material = obj.data.materials[0]
    runtime = bpy.data.materials.new("Armillary — honed ivory and vertex cavities")
    runtime.use_nodes = True
    runtime.diffuse_color = (.62, .60, .56, 1)
    surface = runtime.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = runtime.diffuse_color
    surface.inputs["Roughness"].default_value = .56
    surface.inputs["Metallic"].default_value = 0
    runtime.use_backface_culling = True
    obj.data.materials[0] = runtime
    activate(obj)
    try:
        bpy.ops.export_scene.gltf(filepath=str(RUNTIME / "armillary.glb"), export_format="GLB",
            use_selection=True, export_yup=True, export_texcoords=False, export_normals=True,
            export_materials="EXPORT", export_vertex_color="ACTIVE", export_cameras=False,
            export_lights=False, export_animations=False, export_attributes=False,
            export_copyright=COPYRIGHT)
    finally:
        obj.data.materials[0] = material
        bpy.data.materials.remove(runtime)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--review-only", action="store_true")
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "armillary-study")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    obj, source_reports, export_reports = make_source()
    report = studio.topology_report(obj)
    if len(report["island_vertex_counts"]) != len(source_reports):
        raise RuntimeError("Export contains unexpected detached fragments.")
    studio.setup_studio()
    cavity = studio.bake_cavity(obj)
    studio.render_review(args.preview_dir)
    bpy.context.scene.camera.location = (4.1, -8, .4)
    studio.aim(bpy.context.scene.camera)
    activate(obj)
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region = area.spaces.active.region_3d
                region.view_distance = 5
                region.view_location = (0, 0, 0)
                region.view_rotation = bpy.context.scene.camera.rotation_euler.to_quaternion()
    text = bpy.data.texts.new("ARMILLARY SOURCE AND PROVENANCE")
    text.write(COPYRIGHT + "\nSource: rebuild_armillary.py; all geometry is original.\n")
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "armillary.blend"), compress=True)
    if not args.review_only:
        RUNTIME.mkdir(parents=True, exist_ok=True)
        export(obj)
        encoder = shutil.which("cwebp")
        if not encoder:
            raise RuntimeError("cwebp is required to package the static fallback.")
        subprocess.run([encoder, "-quiet", "-q", "86", "-alpha_q", "100", "-m", "6",
            str(args.preview_dir / "three-quarter.png"), "-o", str(RUNTIME / "armillary.webp")], check=True)
    result = {"source": "Original procedural geometry: rebuild_armillary.py", "copyright": COPYRIGHT,
              "intentional_closed_components": source_reports, "simplified_closed_components": export_reports,
              "export": report, "linear_cavity": cavity, "source_preserved": True,
              "export_simplified_separately": True}
    (SOURCE / "sources/armillary-validation.json").write_text(json.dumps(result, indent=2) + "\n")
    print("ARMILLARY_STUDY", json.dumps(result), flush=True)


if __name__ == "__main__":
    main()
