"""Fit an original soft six-panel dad cap to the licensed Aristotle scan.

Reads coach.blend without modifying it. Writes only the shop study, runtime
assets, and shop-validation.json. Run with Blender 5.1+, --review-only to inspect
front/profile/three-quarter renders before replacing the runtime assets.
"""
import argparse
from collections import Counter
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
ROOT = HERE.parents[1]
OUT = ROOT / 'website/assets/journey'
spec = importlib.util.spec_from_file_location('coach_source', HERE / 'rebuild_coach.py')
coach = importlib.util.module_from_spec(spec)
spec.loader.exec_module(coach)
PARTS = []
CX, CY = 0.13, -0.12
RX, RY = 0.945, 1.025
COPYRIGHT = (
    'Adapted from "Aristotele bust" by nicola_scaramella. '
    'https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930 '
    'Licensed CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. '
    'Changes: orientation, normalization, restrained relief enhancement, export '
    'decimation, marble material, vertex cavity shading, and an original fitted '
    'six-panel dad cap with curved visor, seams, stitching, eyelets and rear strap. '
    'Coaching sculpture remains unchanged.'
)


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.data.collections[coach.DISPLAY_COLLECTION].objects.link(obj)
    bm = bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data); bm.free()
    for poly in data.polygons: poly.use_smooth = True
    PARTS.append(obj)
    return obj


def tube(name, points, radius, sides=6):
    """Closed, fine stitch geometry sunk into the cap's carved surface."""
    points = [Vector(p) for p in points]
    vertices, faces = [], []
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)]).normalized()
        helper = Vector((0, 0, 1)) if abs(tangent.z) < .85 else Vector((0, 1, 0))
        a = tangent.cross(helper).normalized(); b = tangent.cross(a).normalized()
        for j in range(sides):
            angle = math.tau * j / sides
            vertices.append(tuple(point + radius * (a * math.cos(angle) + b * math.sin(angle))))
    for i in range(len(points) - 1):
        for j in range(sides):
            p = i * sides + j; q = i * sides + (j + 1) % sides
            faces.append((p, q, q + sides, p + sides))
    faces.append(tuple(range(sides - 1, -1, -1)))
    faces.append(tuple((len(points) - 1) * sides + j for j in range(sides)))
    return mesh(name, vertices, faces)


def seam_distance(phi):
    return abs((phi + math.pi / 6) % (math.pi / 3) - math.pi / 6)


def base_height(phi):
    # Front band sits on the forehead; rear band rests above the ears.
    return .52 + .26 * max(0, math.cos(phi)) ** 2


def crown(phi, s, offset=0):
    radial = math.sin(math.pi / 2 * s) ** .72
    height = math.cos(math.pi / 2 * s) ** 1.30
    base = base_height(phi)
    z = base + (1.465 - base) * height
    z -= .024 * math.sin(3 * phi) ** 2 * math.exp(-((s - .86) / .15) ** 2)
    # Very shallow panel seams and compression folds; no helmet-like raised ribs.
    groove = .008 * math.exp(-(seam_distance(phi) / .013) ** 2) * math.sin(math.pi * s) ** .45
    wrinkle = .010 * math.sin(15 * phi + 10 * s) * math.sin(math.pi * s) * s ** 5
    wrinkle += .006 * math.sin(27 * phi - 8 * s) * s ** 7
    wrinkle += .014 * math.sin(11 * phi + 8 * s) * math.exp(-((s - .83) / .16) ** 2)
    r = radial + wrinkle - groove
    x = CX + (RX * r + offset) * math.sin(phi)
    y = CY - (RY * r + offset) * math.cos(phi)
    return Vector((x, y, z + offset * (1 - s)))


def opening_limit(phi):
    distance = abs((phi - math.pi + math.pi) % math.tau - math.pi)
    if distance >= .42: return 1.0
    return 1 - .19 * math.sqrt(max(0, 1 - (distance / .42) ** 2))


def build_crown():
    rows, columns = 44, 144
    vertices = [tuple(crown(0, 0))]
    for i in range(1, rows + 1):
        for j in range(columns):
            phi = math.tau * j / columns
            s = i / rows * opening_limit(phi)
            vertices.append(tuple(crown(phi, s)))
    faces = []
    for j in range(columns): faces.append((0, 1 + j, 1 + (j + 1) % columns))
    for i in range(rows - 1):
        for j in range(columns):
            a = 1 + i * columns + j; b = 1 + i * columns + (j + 1) % columns
            faces.append((a, a + columns, b + columns, b))
    obj = mesh('Dad cap — soft six-panel crown', vertices, faces)
    bpy.context.view_layer.objects.active = obj
    solid = obj.modifiers.new('Folded fabric thickness', 'SOLIDIFY'); solid.thickness = .020; solid.offset = -1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # Fine hem follows the rear opening instead of spanning it like a helmet rim.
    edge = [crown(math.tau * j / 180, opening_limit(math.tau * j / 180), -.001) for j in range(181)]
    tube('Dad cap — folded lower hem', edge, .009, 6)
    for k in range(6):
        phi = k * math.pi / 3
        limit = opening_limit(phi)
        for side in [-1, 1]:
            angle = phi + side * .014
            for n in range(33):
                start = .11 + (limit - .13) * n / 33
                end = start + (limit - .13) / 33 * .61
                pts = [crown(angle, start + (end - start) * j / 2, .001) for j in range(3)]
                tube('Dad cap — panel topstitch', pts, .0025, 5)
    # Six stitched ventilation eyelets, placed within the panels.
    for k in range(6):
        phi = (k + .5) * math.pi / 3
        center = crown(phi, .67, .001)
        tangent = (crown(phi + .001, .67) - crown(phi - .001, .67)).normalized()
        up = (crown(phi, .669) - crown(phi, .671)).normalized()
        ring = [center + tangent * (.018 * math.cos(math.tau * j / 24)) + up * (.015 * math.sin(math.tau * j / 24)) for j in range(25)]
        tube('Dad cap — stitched eyelet rim', ring, .004, 6)
        # Recessed small cone supplies an actual cavity with a closed back.
        normal = tangent.cross(up).normalized()
        if normal.dot(Vector((math.sin(phi), -math.cos(phi), .4))) < 0: normal = -normal
        verts = [tuple(center - normal * .008)]
        verts += [tuple(center + tangent * (.012 * math.cos(math.tau * j / 24)) + up * (.010 * math.sin(math.tau * j / 24))) for j in range(24)]
        faces = [(0, 1 + j, 1 + (j + 1) % 24) for j in range(24)]
        verts.append(tuple(center - normal * .013)); faces += [(25, 1 + (j + 1) % 24, 1 + j) for j in range(24)]
        mesh('Dad cap — recessed ventilation', verts, faces)
    # A cloth-covered low button, not a sphere perched on the hat.
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=(CX, CY, 1.467))
    button = bpy.context.object; button.name = 'Dad cap — cloth-covered button'; button.scale = (.046, .046, .023)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    coach.move_to(button, bpy.data.collections[coach.DISPLAY_COLLECTION]); PARTS.append(button)
    for face in button.data.polygons: face.use_smooth = True


def visor(u, v, offset=0):
    x = CX + u * (.85 + .12 * math.sin(math.pi / 2 * v))
    attach = CY - RY * math.sqrt(max(.02, 1 - (.85 * u / RX) ** 2))
    y = attach - .73 * v * max(0, 1 - u * u) ** .42
    z = .770 - .255 * u * u + .01 * v - .025 * v * v + offset
    return Vector((x, y, z))


def build_visor():
    columns, rows = 80, 22
    vertices = [tuple(visor(-1 + 2 * j / columns, i / rows)) for i in range(rows + 1) for j in range(columns + 1)]
    faces = []
    for i in range(rows):
        for j in range(columns):
            a = i * (columns + 1) + j; faces.append((a, a + 1, a + columns + 2, a + columns + 1))
    obj = mesh('Dad cap — curved soft visor', vertices, faces)
    bpy.context.view_layer.objects.active = obj
    solid = obj.modifiers.new('Turned visor edge thickness', 'SOLIDIFY'); solid.thickness = .023; solid.offset = -1
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # Rolled front edge is thin and follows the real downward side curvature.
    tube('Dad cap — bound visor edge', [visor(-1 + 2 * j / 80, 1, -.005) for j in range(81)], .010, 6)
    for row in range(6):
        v = .22 + row * .125
        for k in range(57):
            start = -.97 + 1.94 * k / 57
            end = start + 1.94 / 57 * .62
            points = [visor(start + (end - start) * j, v, .001) for j in range(2)]
            tube('Dad cap — concentric visor stitching', points, .0026, 5)


def build_strap():
    vertices, faces = [], []
    for i in range(61):
        phi = math.pi - .50 + i / 60
        for j in range(2):
            z = .515 + j * .080
            vertices.append((CX + (RX + .007) * math.sin(phi), CY - (RY + .007) * math.cos(phi), z))
    for i in range(60):
        a = i * 2; faces.append((a, a + 1, a + 3, a + 2))
    obj = mesh('Dad cap — adjustable rear strap', vertices, faces)
    bpy.context.view_layer.objects.active = obj
    solid = obj.modifiers.new('Rear strap thickness', 'SOLIDIFY'); solid.thickness = .018
    bpy.ops.object.modifier_apply(modifier=solid.name)
    # A small squared stone buckle sits against the rear strap.
    points = [(CX - .11, CY + RY + .014, .519), (CX + .01, CY + RY + .014, .519),
              (CX + .01, CY + RY + .014, .602), (CX - .11, CY + RY + .014, .602),
              (CX - .11, CY + RY + .014, .519)]
    tube('Dad cap — rear adjustment buckle', points, .010, 6)


def fit_hidden_hair(obj):
    """Compress only scalp/hair under the cap; preserve the face and beard."""
    changed = 0
    for vertex in obj.data.vertices:
        p = vertex.co
        if p.z <= .60: continue
        weight = min(1, max(0, (p.z - .60) / .50))
        p.x = CX + (p.x - CX) * (1 - .080 * weight)
        p.y = CY + (p.y - CY) * (1 - .080 * weight)
        p.z = .60 + (p.z - .60) * (1 - .14 * weight)
        changed += 1
    obj.data.update()
    return changed


def prepare():
    source_path = HERE / 'coach.blend'
    source_hash = hashlib.sha256(source_path.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source_path))
    obj = coach.study_object(); obj.name = 'Aristotle in a dad cap — shop study'
    anatomy_before = np.array([v.co[:] for v in obj.data.vertices])
    modified = fit_hidden_hair(obj)
    anatomy_after = np.array([v.co[:] for v in obj.data.vertices])
    protected = anatomy_before[:, 2] <= .60
    if not np.array_equal(anatomy_before[protected], anatomy_after[protected]):
        raise RuntimeError('Protected face/beard/bust vertices changed.')
    PARTS.append(obj)
    build_crown(); build_visor(); build_strap()
    bpy.ops.object.select_all(action='DESELECT')
    for part in PARTS: part.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    for attr in list(obj.data.color_attributes): obj.data.color_attributes.remove(attr)
    obj.data.materials.clear(); obj.data.materials.append(coach.marble_material())
    bm = bmesh.new(); bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=bm.faces)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data); bm.free(); obj.data.update()
    for face in obj.data.polygons: face.use_smooth = True
    bpy.context.scene.camera.data.ortho_scale = 3.65
    # A broad low bounce keeps the original eyes legible under the curved visor.
    bpy.ops.object.light_add(type='AREA', location=(-3.5, -4, .4))
    bounce = bpy.context.object; bounce.name = 'Shop — soft portrait bounce'
    bounce.data.energy = 95; bounce.data.shape = 'DISK'; bounce.data.size = 2.6
    bounce.data.color = (1, .95, .87); coach.aim(bounce, (0, -.4, .05))
    coach.move_to(bounce, bpy.data.collections[coach.STUDIO_COLLECTION])
    obj['attribution'] = COPYRIGHT
    for text in list(bpy.data.texts):
        if text.name.startswith('SOURCE AND LICENSE'): bpy.data.texts.remove(text)
    bpy.data.texts.new('SOURCE AND LICENSE').write(COPYRIGHT)
    return obj, source_hash, {'protected_vertices_unchanged': int(protected.sum()), 'covered_scalp_vertices_adjusted': modified}


def render_review(directory):
    directory.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.cycles.samples = 96
    views = [
        ('front', (0, -8, .3), (0, 0, 0), 3.65),
        ('profile', (8, -.35, .3), (0, -.35, 0), 4.2),
        ('rear', (2.9, 8, .5), (0, 0, 0), 3.65),
        ('three-quarter', (4.1, -8, .4), (0, 0, 0), 3.65),
    ]
    for name, location, target, framing in views:
        scene.camera.data.ortho_scale = framing
        scene.camera.location = location
        coach.aim(scene.camera, target)
        scene.render.filepath = str(directory / (name + '.png'))
        bpy.ops.render.render(write_still=True)


def export_shop(obj):
    material = obj.data.materials[0]
    runtime = bpy.data.materials.new('Shop — ivory marble with vertex cavities'); runtime.use_nodes = True
    runtime.diffuse_color = material.diffuse_color; runtime.use_backface_culling = True
    surface = runtime.node_tree.nodes.get('Principled BSDF')
    surface.inputs['Base Color'].default_value = runtime.diffuse_color
    surface.inputs['Roughness'].default_value = .56; surface.inputs['Metallic'].default_value = 0
    obj.data.materials[0] = runtime
    try:
        bpy.ops.export_scene.gltf(filepath=str(OUT / 'shop.glb'), export_format='GLB', use_selection=True,
            export_yup=True, export_texcoords=False, export_normals=True, export_materials='EXPORT',
            export_vertex_color='ACTIVE', export_cameras=False, export_lights=False, export_animations=False,
            export_attributes=False, export_copyright=COPYRIGHT)
    finally:
        obj.data.materials[0] = material; bpy.data.materials.remove(runtime)


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-only', action='store_true')
    parser.add_argument('--quick', action='store_true')
    parser.add_argument('--preview-dir', type=Path, default=Path(tempfile.gettempdir()) / 'aristotle-shop')
    opts = parser.parse_args(args)
    obj, source_hash, anatomy = prepare()
    scene = bpy.context.scene
    if opts.quick:
        scene.render.resolution_x = 660; scene.render.resolution_y = 780
    colors = coach.bake_cavity(obj)
    topology = coach.topology_report(obj)
    if topology['nonmanifold_edges'] or topology['signed_volume'] <= 0:
        raise RuntimeError(f'Non-manifold or reversed sculpture: {topology}')
    render_review(opts.preview_dir)
    coach.save_study(HERE / 'shop.blend')
    if not opts.review_only:
        export_shop(obj)
        encoder = shutil.which('cwebp')
        if not encoder: raise RuntimeError('cwebp is required for fallback packaging.')
        subprocess.run([encoder, '-quiet', '-q', '86', '-alpha_q', '100', '-m', '6',
            str(opts.preview_dir / 'three-quarter.png'), '-o', str(OUT / 'shop.webp')], check=True)
    if hashlib.sha256((HERE / 'coach.blend').read_bytes()).hexdigest() != source_hash:
        raise RuntimeError('Coaching source was modified.')
    islands = topology.pop('island_vertex_counts')
    topology['island_count'] = len(islands)
    topology['island_vertex_count_histogram'] = dict(sorted(Counter(islands).items()))
    report = {'coach_blend_sha256_unchanged': source_hash, 'anatomy': anatomy, 'export': topology,
              'linear_cavity': colors, 'copyright': COPYRIGHT}
    (HERE / 'sources/shop-validation.json').write_text(json.dumps(report, indent=2) + '\n')
    print('SHOP_STUDY', json.dumps(report), flush=True)


if __name__ == '__main__': main()
