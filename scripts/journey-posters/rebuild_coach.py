"""Prepare a licensed Aristotle scan in Blender without rebuilding its anatomy.

Run with Blender 5.1+ in background mode, or invoke individual functions through
the official Blender MCP execute bridge. Importing this module does not modify
a scene. The bundled archive was acquired through the creator's normal download
path; see sources/ATTRIBUTION.md for license, attribution and modifications.
"""

import argparse
import hashlib
import io
import json
import math
import shutil
import subprocess
import sys
import tempfile
import zipfile

import numpy as np
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = Path(__file__).resolve().parent
RUNTIME_DIR = ROOT / "website/assets/journey"
SOURCE_COLLECTION = "Aristotle — preserved scan"
DISPLAY_COLLECTION = "Aristotle — marble study"
STUDIO_COLLECTION = "Aristotle — portrait studio"


def collection(name):
    value = bpy.data.collections.get(name)
    if value is None:
        value = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(value)
    return value


def move_to(obj, target):
    for owner in list(obj.users_collection):
        owner.objects.unlink(obj)
    target.objects.link(obj)


def topology_report(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    unseen = set(bm.verts)
    islands = []
    while unseen:
        seed = unseen.pop()
        pending = [seed]
        count = 0
        while pending:
            vert = pending.pop()
            count += 1
            for edge in vert.link_edges:
                neighbor = edge.other_vert(vert)
                if neighbor in unseen:
                    unseen.remove(neighbor)
                    pending.append(neighbor)
        islands.append(count)
    report = {
        "vertices": len(bm.verts),
        "faces": len(bm.faces),
        "boundary_edges": sum(edge.is_boundary for edge in bm.edges),
        "nonmanifold_edges": sum(not edge.is_manifold for edge in bm.edges),
        "island_vertex_counts": sorted(islands, reverse=True),
        "signed_volume": bm.calc_volume(signed=True),
    }
    bm.free()
    return report


def inspect_import(source_path):
    """Import the licensed file and preserve the complete source geometry."""
    source = Path(source_path).resolve()
    if not source.is_file():
        raise FileNotFoundError(source)
    if bpy.data.collections.get(SOURCE_COLLECTION):
        raise RuntimeError("A source scan is already loaded; inspect it before replacing it.")
    before = set(bpy.data.objects)
    suffix = source.suffix.lower()
    if suffix in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=str(source))
    elif suffix == ".obj":
        bpy.ops.wm.obj_import(filepath=str(source))
    elif suffix == ".stl":
        bpy.ops.wm.stl_import(filepath=str(source))
    else:
        raise ValueError("Expected glTF, GLB, OBJ or STL geometry.")
    imported = [obj for obj in bpy.data.objects if obj not in before]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    if not meshes:
        raise RuntimeError("The source file did not contain a mesh.")
    preserved = collection(SOURCE_COLLECTION)
    for obj in imported:
        move_to(obj, preserved)
    return {obj.name: topology_report(obj) for obj in meshes}


def make_study(yaw_degrees=0, tilt_degrees=0, target_triangles=180000):
    """Make a separate export copy while retaining the scan's facial structure."""
    preserved = bpy.data.collections.get(SOURCE_COLLECTION)
    if preserved is None:
        raise RuntimeError("Import and review the source scan first.")
    if bpy.data.collections.get(DISPLAY_COLLECTION):
        raise RuntimeError("The study already exists; review before replacing it.")
    display = collection(DISPLAY_COLLECTION)
    copies = []
    bpy.ops.object.select_all(action="DESELECT")
    for source in preserved.objects:
        if source.type != "MESH":
            continue
        obj = bpy.data.objects.new(source.name + " — study", source.data.copy())
        display.objects.link(obj)
        obj.matrix_world = source.matrix_world.copy()
        obj.select_set(True)
        copies.append(obj)
    bpy.context.view_layer.objects.active = copies[0]
    if len(copies) > 1:
        bpy.ops.object.join()
    study = bpy.context.object
    study.name = "Aristotle — marble exhibition copy"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    study.rotation_euler = (math.radians(tilt_degrees), 0, math.radians(yaw_degrees))
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    points = [vert.co for vert in study.data.vertices]
    low = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    high = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    center = (low + high) / 2
    scale = 3 / (high.z - low.z)
    for vert in study.data.vertices:
        vert.co = (vert.co - center) * scale
    study.data.validate(clean_customdata=True)
    bm = bmesh.new()
    bm.from_mesh(study.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.000002)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.000001)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(study.data)
    bm.free()
    study.data.calc_loop_triangles()
    triangles = len(study.data.loop_triangles)
    enhance_scan_relief(study)
    if triangles > target_triangles:
        decimate = study.modifiers.new("Conservative exhibition LOD", "DECIMATE")
        decimate.ratio = target_triangles / triangles
        decimate.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    bm = bmesh.new()
    bm.from_mesh(study.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(study.data)
    bm.free()
    study.data.update()
    for face in study.data.polygons:
        face.use_smooth = True
    preserved.hide_viewport = True
    preserved.hide_render = True
    for obj in bpy.data.objects:
        if obj.name in ("Cube", "Camera", "Light") and obj.name not in display.objects:
            obj.hide_set(True)
            obj.hide_render = True
    study.data.materials.clear()
    study.data.materials.append(marble_material())
    return topology_report(study)


def marble_material():
    """Quiet fine-grained marble; structure must carry the visual detail."""
    mat = bpy.data.materials.new("Aristotle — warm honed marble")
    mat.diffuse_color = (0.62, 0.60, 0.56, 1)
    mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    surface = nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = mat.diffuse_color
    surface.inputs["Metallic"].default_value = 0
    surface.inputs["Roughness"].default_value = 0.56
    surface.inputs["Subsurface Weight"].default_value = 0.025
    coordinate = nodes.new("ShaderNodeTexCoord")
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 145
    grain.inputs["Detail"].default_value = 2
    links.new(coordinate.outputs["Generated"], grain.inputs["Vector"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.12
    bump.inputs["Distance"].default_value = 0.007
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], surface.inputs["Normal"])
    return mat


def study_object():
    display = bpy.data.collections.get(DISPLAY_COLLECTION)
    if display is None:
        raise RuntimeError("No study copy exists.")
    return next(obj for obj in display.objects if obj.type == "MESH")


def aim(obj, point=(0, 0, 0)):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat("-Z", "Y").to_euler()


def setup_studio():
    scene = bpy.context.scene
    studio = collection(STUDIO_COLLECTION)
    if len(studio.objects):
        raise RuntimeError("Studio already exists.")
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1100
    scene.render.resolution_y = 1300
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "AgX"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("Quiet gallery")
    scene.world.use_nodes = True
    background = scene.world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.045, 0.05, 0.06, 1)
    background.inputs["Strength"].default_value = 0.4
    bpy.ops.object.camera_add(location=(4.1, -8, 0.4))
    camera = bpy.context.object
    camera.name = "Aristotle — three quarter portrait"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 3.65
    aim(camera)
    move_to(camera, studio)
    scene.camera = camera
    for name, location, energy, size, color in [
        ("Sculpting key", (-3.5, -4, 4.7), 650, 2, (1, 0.94, 0.84)),
        ("Soft gallery fill", (4, -1.5, 0.4), 110, 3.5, (0.84, 0.9, 1)),
        ("Stone rim", (1, 3, 3.8), 640, 3, (1, 0.96, 0.89)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        lamp = bpy.context.object
        lamp.name = "Aristotle — " + name
        lamp.data.energy = energy
        lamp.data.shape = "DISK"
        lamp.data.size = size
        lamp.data.color = color
        aim(lamp)
        move_to(lamp, studio)
    return {"camera": camera.name, "lights": 3}


def save_study(destination=None):
    obj = study_object()
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                region = area.spaces.active.region_3d
                region.view_distance = 5
                region.view_location = (0, 0, 0)
                if bpy.context.scene.camera:
                    region.view_rotation = bpy.context.scene.camera.rotation_euler.to_quaternion()
    bpy.context.preferences.filepaths.save_version = 0
    target = Path(destination) if destination else SOURCE_DIR / "coach-study.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
    return {"saved": str(target), "topology": topology_report(obj)}


SOURCE_ARCHIVE_SHA256 = "c06b75a36fe3d7c378bf426d95d11f50a0639261453cc522e22def17538e0565"
COPYRIGHT = (
    'Adapted from "Aristotele bust" by nicola_scaramella. '
    'https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930 '
    'Licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. '
    'Changes: orientation, normalization, restrained relief enhancement, '
    'export decimation, marble material and vertex cavity shading.'
)


def enhance_scan_relief(obj):
    """Enhance existing relief slightly; never synthesize facial features.

    Normal-only displacement is capped at 0.3% of the normalized bust height.
    The untouched imported scan remains in a separate hidden collection.
    """
    vertices = np.array([vert.co[:] for vert in obj.data.vertices], dtype=np.float64)
    normals = np.array([vert.normal[:] for vert in obj.data.vertices], dtype=np.float64)
    edges = np.array([edge.vertices[:] for edge in obj.data.edges], dtype=np.int32)
    counts = np.zeros(len(vertices), dtype=np.float64)
    np.add.at(counts, edges[:, 0], 1)
    np.add.at(counts, edges[:, 1], 1)
    smooth = vertices.copy()
    for _ in range(32):
        total = np.zeros_like(smooth)
        np.add.at(total, edges[:, 0], smooth[edges[:, 1]])
        np.add.at(total, edges[:, 1], smooth[edges[:, 0]])
        smooth = 0.45 * smooth + 0.55 * total / counts[:, None]
    displacement = np.clip(((vertices - smooth) * normals).sum(axis=1) * 0.8, -0.009, 0.009)
    obj.data.vertices.foreach_set("co", (vertices + normals * displacement[:, None]).ravel())
    obj.data.update()
    # Recentering after relief keeps the runtime contract exact.
    points = np.array([vert.co[:] for vert in obj.data.vertices])
    low, high = points.min(axis=0), points.max(axis=0)
    points = (points - (low + high) / 2) * (3 / (high[2] - low[2]))
    obj.data.vertices.foreach_set("co", points.ravel())
    obj.data.update()


def bake_cavity(obj):
    """Bake local occlusion into linear grayscale COLOR_0, without image maps."""
    scene = bpy.context.scene
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    material = obj.data.materials[0]
    nodes, links = material.node_tree.nodes, material.node_tree.links
    surface, output = nodes.get("Principled BSDF"), nodes.get("Material Output")
    attr = obj.data.color_attributes.new(name="Marble cavity", type="FLOAT_COLOR", domain="POINT")
    obj.data.color_attributes.active_color = attr
    scene.cycles.samples = 64
    occlusion = nodes.new("ShaderNodeAmbientOcclusion")
    occlusion.inputs["Distance"].default_value = 0.14
    occlusion.samples = 32
    occlusion.only_local = True
    emission = nodes.new("ShaderNodeEmission")
    links.new(occlusion.outputs["Color"], emission.inputs["Color"])
    links.new(emission.outputs[0], output.inputs["Surface"])
    bpy.ops.object.bake(type="EMIT", target="VERTEX_COLORS")
    colors = np.empty(len(attr.data) * 4, dtype=np.float32)
    attr.data.foreach_get("color", colors)
    colors = colors.reshape((-1, 4))
    colors[:, :3] = 0.65 + 0.35 * np.clip(colors[:, :3], 0, 1)
    colors[:, 3] = 1
    attr.data.foreach_set("color", colors.ravel())
    links.new(surface.outputs[0], output.inputs["Surface"])
    nodes.remove(occlusion)
    nodes.remove(emission)
    vertex = nodes.new("ShaderNodeVertexColor")
    vertex.layer_name = attr.name
    multiply = nodes.new("ShaderNodeMixRGB")
    multiply.blend_type = "MULTIPLY"
    multiply.inputs[0].default_value = 1
    multiply.inputs[2].default_value = material.diffuse_color
    links.new(vertex.outputs["Color"], multiply.inputs[1])
    links.new(multiply.outputs[0], surface.inputs["Base Color"])
    return {"minimum": float(colors[:, 0].min()), "mean": float(colors[:, 0].mean()), "maximum": float(colors[:, 0].max())}


def render_review(directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.cycles.samples = 96
    for name, location in [
        ("front", (0, -8, 0.3)),
        ("profile", (8, 0, 0.3)),
        ("three-quarter", (4.1, -8, 0.4)),
    ]:
        scene.camera.location = location
        aim(scene.camera)
        scene.render.filepath = str(directory / (name + ".png"))
        bpy.ops.render.render(write_still=True)


def export_runtime(obj):
    RUNTIME_DIR.mkdir(parents=True, exist_ok=True)
    material = obj.data.materials[0]
    # Export a portable constant ivory factor and the active grayscale attribute.
    # Fine procedural grain stays in the editable .blend and runtime shader.
    runtime = bpy.data.materials.new("Aristotle — ivory marble with vertex cavities")
    runtime.use_nodes = True
    runtime.diffuse_color = material.diffuse_color
    surface = runtime.node_tree.nodes.get("Principled BSDF")
    surface.inputs["Base Color"].default_value = runtime.diffuse_color
    surface.inputs["Roughness"].default_value = 0.56
    surface.inputs["Metallic"].default_value = 0
    runtime.use_backface_culling = True
    obj.data.materials[0] = runtime
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    try:
        bpy.ops.export_scene.gltf(
            filepath=str(RUNTIME_DIR / "coach.glb"),
            export_format="GLB", use_selection=True, export_yup=True,
            export_texcoords=False, export_normals=True, export_materials="EXPORT",
            export_vertex_color="ACTIVE", export_cameras=False, export_lights=False,
            export_animations=False, export_attributes=False, export_copyright=COPYRIGHT,
        )
    finally:
        obj.data.materials[0] = material
        bpy.data.materials.remove(runtime)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--preview-dir", type=Path, default=Path(tempfile.gettempdir()) / "aristotle-study/final")
    parser.add_argument("--review-only", action="store_true", help="Render and save the editable study without replacing browser assets.")
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else [])
    archive = SOURCE_DIR / "sources/aristotele-bust.zip"
    data = archive.read_bytes()
    if hashlib.sha256(data).hexdigest() != SOURCE_ARCHIVE_SHA256:
        raise ValueError("The licensed source archive differs from the documented download.")
    # Read only the two known archive members; never execute downloaded content.
    with zipfile.ZipFile(io.BytesIO(data)) as outer:
        nested = outer.read("source/bec055ddf65e4997b6b4fc4ed5a45275.zip.zip")
    with zipfile.ZipFile(io.BytesIO(nested)) as inner:
        stl = inner.read("Aristotele (repaired).stl")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    with tempfile.TemporaryDirectory(prefix="aristotle-source-") as temp:
        source = Path(temp) / "Aristotele (repaired).stl"
        source.write_bytes(stl)
        source_report = inspect_import(source)
    make_study(yaw_degrees=-70, target_triangles=180000)
    obj = study_object()
    report = topology_report(obj)
    if report["nonmanifold_edges"] or len(report["island_vertex_counts"]) != 1 or report["signed_volume"] <= 0:
        raise RuntimeError(f"Export mesh must remain one outward-facing watertight surface: {report}")
    setup_studio()
    cavity = bake_cavity(obj)
    obj["attribution"] = COPYRIGHT
    text = bpy.data.texts.new("SOURCE AND LICENSE")
    text.write(COPYRIGHT + "\n\nThe hidden source collection preserves the full imported scan.\n")
    render_review(args.preview_dir)
    save_study(SOURCE_DIR / "coach.blend")
    if not args.review_only:
        export_runtime(obj)
        encoder = shutil.which("cwebp")
        if not encoder:
            raise RuntimeError("cwebp is required to package the transparent fallback.")
        subprocess.run([
            encoder, "-quiet", "-q", "86", "-alpha_q", "100", "-m", "6",
            str(args.preview_dir / "three-quarter.png"), "-o", str(RUNTIME_DIR / "coach.webp"),
        ], check=True)
    validation = {"source": source_report, "export": report, "linear_cavity": cavity, "copyright": COPYRIGHT}
    (SOURCE_DIR / "sources/coach-validation.json").write_text(json.dumps(validation, indent=2) + "\n")
    print("ARISTOTLE_STUDY", json.dumps(validation), flush=True)


if __name__ == "__main__":
    main()
