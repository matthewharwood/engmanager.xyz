"""Rebuild the architectural cursor meshes with Blender 5.x.

/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup \
  --python scripts/build-cursor-models.py

Only Blender's bundled Python/modules are required. All source meshes, material
nodes, shape keys, and a presentation camera remain editable in cursors.blend.
"""
import bpy
import math
import json
import struct
from pathlib import Path
from mathutils import Vector, Matrix

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / 'website/assets/cursors/v1'
DOCS = ROOT / '_docs/cursors'
ASSETS.mkdir(parents=True, exist_ok=True)
DOCS.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for block in list(bpy.data.materials):
    bpy.data.materials.remove(block)


def material(name, color, roughness=0.8):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = 0
    # Keep export in core glTF PBR; no optional specular extensions.
    bsdf.inputs['Specular IOR Level'].default_value = 0.5
    return mat

CONCRETE = material('Limestone / cast concrete', (0.63, 0.60, 0.51))
CUT = material('Freshly cut chamfers', (0.47, 0.455, 0.405))
DARK = material('Graphite / recessed expansion joints', (0.065, 0.079, 0.075))
OXIDE = material('Oxide enamel / maker inset', (0.63, 0.052, 0.036), 0.54)


def active(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def finish(obj, name, mat=CONCRETE, bevel=0.026):
    obj.name = name
    obj.data.materials.append(mat)
    if bevel:
        obj.data.materials.append(CUT if mat == CONCRETE else mat)
        mod = obj.modifiers.new('Crisp architectural chamfer', 'BEVEL')
        mod.width = bevel
        mod.segments = 1
        mod.affect = 'EDGES'
        mod.material = 1
        active(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    active(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def slab(name, center, scale, mat=CONCRETE, bevel=0.026, angle=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.dimensions = scale
    obj.rotation_euler.z = angle
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)


def polygon(name, points, front=0, back=-0.30, mat=CONCRETE, bevel=0.027):
    n = len(points)
    vertices = [(x, y, back) for x, y in points] + [(x, y, front) for x, y in points]
    faces = [tuple(reversed(range(n))), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, mat, bevel)


# Polygon winding is counter-clockwise in the XY plane, front facing +Z.
arrow = []
arrow.append(polygon('Pointer / monolithic arrow', [
    (0, 0), (0.055, -1.63), (0.46, -1.255), (0.885, -2.34),
    (1.23, -2.20), (0.805, -1.155), (1.545, -1.17),
]))
# Tiny recessed-looking strip and a red datum make the object feel fabricated.
arrow.append(slab('Pointer / stem expansion joint', (0.845, -1.81, 0.003),
                  (0.065, 0.49, 0.014), DARK, 0.004, 0.373))
arrow.append(slab('Pointer / oxide datum', (0.918, -1.997, 0.013),
                  (0.056, 0.106, 0.018), OXIDE, 0.003, 0.373))

hand = []
finger_parts = []
# A sculpted pentagonal palm, separate backplate and cuff give the hand a
# substantial mass while the negative finger gaps preserve its cursor silhouette.
hand.append(polygon('Hand / graphite palm reveal', [
    (0.015, -1.05), (0.11, -1.91), (0.29, -2.12), (1.14, -2.12),
    (1.46, -1.89), (1.42, -1.105),
], front=-0.11, back=-0.315, mat=DARK, bevel=0.024))
hand.append(polygon('Hand / cast palm', [
    (0.045, -1.035), (0.135, -1.88), (0.32, -2.035), (1.115, -2.035),
    (1.4, -1.865), (1.37, -1.07),
], front=0.045, back=-0.12, bevel=0.046))
# Each finger is two precast blocks over a dark structural link. Intentional
# stepped lengths and slightly splayed last digit read as an open hand.
for index, (x, top, width, root) in enumerate([
    (0.145, 0.0, 0.29, -1.265),
    (0.515, -0.075, 0.30, -1.29),
    (0.895, -0.265, 0.30, -1.31),
    (1.235, -0.53, 0.26, -1.35),
]):
    split = root + (top - root) * 0.53
    core = slab(f'Hand / finger {index + 1} structural link',
                (x, split - 0.015, -0.075),
                (width * 0.59, 0.155, 0.16), DARK, 0)
    proximal = slab(f'Hand / finger {index + 1} proximal block',
                    (x, (root + split) / 2, -0.031),
                    (width, split - root - 0.024, 0.31), CONCRETE, 0.03)
    distal = slab(f'Hand / finger {index + 1} distal block',
                  (x, (split + top) / 2, -0.008),
                  (width, top - split - 0.047, 0.29), CONCRETE, 0.033)
    for obj in [core, proximal, distal]:
        hand.append(obj)
        finger_parts.append((obj, root, top, index))
# Thumb hinges off the right edge; its outward slant is deliberately sculptural.
thumb_core = slab('Hand / thumb hinge', (1.43, -1.535, -0.14),
                  (0.25, 0.56, 0.22), DARK, 0, -0.53)
thumb = slab('Hand / thumb cantilever', (1.585, -1.26, 0.018),
             (0.34, 0.72, 0.35), CONCRETE, 0.044, -0.53)
hand.extend([thumb_core, thumb])
hand.append(slab('Hand / cuff shadow course', (0.712, -2.115, -0.14),
                 (0.95, 0.205, 0.30), DARK, 0))
hand.append(slab('Hand / cuff plinth', (0.712, -2.31, -0.066),
                 (1.035, 0.28, 0.405), CONCRETE, 0.035))
hand.append(slab('Hand / cuff recessed datum', (0.45, -2.295, 0.14),
                 (0.225, 0.052, 0.017), DARK, 0.006))
hand.append(slab('Hand / cuff oxide inset', (0.453, -2.295, 0.153),
                 (0.11, 0.044, 0.018), OXIDE, 0.004))

# Morphs are calculated in Blender and exported by Blender with normal deltas.
# Finger blocks rotate around their architectural hinges, curling toward the
# viewer; the palm itself stays stable. Every hand primitive has the same one
# named target so the small runtime renderer can set a single grip weight.
part_info = {obj.name: (root, top, index) for obj, root, top, index in finger_parts}
for obj in hand:
    obj.shape_key_add(name='Basis')
    grip = obj.shape_key_add(name='Grip')
    grip.value = 0
    if obj.name in part_info:
        root, top, index = part_info[obj.name]
        # Two rigid segments plus a flexible recessed link preserve solid slabs.
        proximal_angle = 1.10 + index * 0.08
        distal_angle = 2.1 + index * 0.07
        split = root + (top - root) * 0.53
        for vertex in grip.data:
            v = vertex.co
            distance = v.y - root
            if 'distal' in obj.name:
                hinge_y = root + (split - root) * math.cos(proximal_angle)
                hinge_z = (split - root) * math.sin(proximal_angle)
                local_y = v.y - split
                v.y = hinge_y + local_y * math.cos(distal_angle) - v.z * math.sin(distal_angle)
                v.z = hinge_z + local_y * math.sin(distal_angle) + v.z * math.cos(distal_angle)
            else:
                angle = proximal_angle
                v.y = root + distance * math.cos(angle) - v.z * math.sin(angle)
                v.z = distance * math.sin(angle) + v.z * math.cos(angle)
    elif obj == thumb or obj == thumb_core:
        pivot = Vector((1.34, -1.82, -0.08))
        rotation = Matrix.Rotation(0.95, 4, 'Y') @ Matrix.Rotation(0.58, 4, 'Z')
        for vertex in grip.data:
            vertex.co = pivot + rotation.to_3x3() @ (vertex.co - pivot)


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    # Explicitly triangulate before export while preserving the shape keys.
    active(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.quads_convert_to_tris(quad_method='BEAUTY', ngon_method='BEAUTY')
    bpy.ops.object.mode_set(mode='OBJECT')
    return obj

pointer = join(arrow, 'Brutalist pointer')
hand_obj = join(hand, 'Brutalist hand')


def rebase_hotspot(obj):
    # Pin a real vertex on the uppermost chamfer to the event coordinates.
    points = obj.data.shape_keys.key_blocks['Basis'].data if obj.data.shape_keys else obj.data.vertices
    top = max(vertex.co.y for vertex in points)
    candidates = [vertex.co.copy() for vertex in points if abs(vertex.co.y - top) < 1e-5]
    origin = min(candidates, key=lambda p: (round(p.x, 5), -p.z))
    anchor_index = min(range(len(points)), key=lambda i: (points[i].co - origin).length)
    if obj.data.shape_keys:
        for key in obj.data.shape_keys.key_blocks:
            # The same index-fingertip vertex stays at the pointer in both poses.
            key_origin = key.data[anchor_index].co.copy()
            for vertex in key.data:
                vertex.co -= key_origin
        for vertex, basis in zip(obj.data.vertices, obj.data.shape_keys.key_blocks['Basis'].data):
            vertex.co = basis.co
    else:
        for vertex in obj.data.vertices:
            vertex.co -= origin


rebase_hotspot(pointer)
rebase_hotspot(hand_obj)
hand_obj.data.shape_keys.key_blocks['Grip'].value = 0


def export(obj, filename):
    active(obj)
    bpy.ops.export_scene.gltf(
        filepath=str(ASSETS / filename), export_format='GLB',
        use_selection=True, export_yup=False, export_texcoords=False,
        export_normals=True, export_tangents=False, export_materials='EXPORT',
        export_vertex_color='NONE', export_all_vertex_colors=False,
        export_animations=False, export_skins=False, export_morph=True,
        export_morph_normal=True, export_morph_tangent=False,
        export_try_sparse_sk=False, export_try_omit_sparse_sk=False,
        export_cameras=False, export_lights=False, export_extras=False,
    )
    raw = (ASSETS / filename).read_bytes()
    length, kind = struct.unpack_from('<II', raw, 12)
    data = json.loads(raw[20:20 + length])
    assert not data.get('extensionsRequired'), 'Runtime supports core glTF only'
    for node in data['nodes']:
        assert not any(key in node for key in ['matrix', 'rotation', 'translation', 'scale']), node
    for mesh in data['meshes']:
        for primitive in mesh['primitives']:
            assert primitive.get('mode', 4) == 4 and 'indices' in primitive
            assert set(primitive['attributes']) == {'POSITION', 'NORMAL'}
            for target in primitive.get('targets', []):
                assert set(target) == {'POSITION', 'NORMAL'}
    print(f'EXPORTED {filename}: {len(raw):,} bytes; {len(data["meshes"][0]["primitives"])} material primitives')


export(pointer, 'pointer.glb')
export(hand_obj, 'hand.glb')

# Compose an honest, untextured source preview on the same dark neutral palette
# as the site. Rendering objects are never selected during the glTF exports.
pointer.location = (-2.4, 1.22, 0)
hand_obj.location = (0.36, 1.22, 0)
for obj in [pointer, hand_obj]:
    obj.rotation_euler = (math.radians(-7), math.radians(-14), math.radians(-4))

scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x = 1000
scene.render.resolution_y = 600
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'JPEG'
scene.render.image_settings.quality = 90
scene.world.color = (0.16, 0.16, 0.16)
scene.world.use_nodes = True
scene.world.node_tree.nodes['Background'].inputs[0].default_value = (0.22, 0.24, 0.23, 1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value = 0.7
scene.view_settings.view_transform = 'AgX'

backdrop = material('Preview background only', (0.023, 0.031, 0.028), 1)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -0.55))
plane = bpy.context.object
plane.name = 'Presentation backdrop — not exported'
plane.data.materials.append(backdrop)


def area(name, position, energy, size, color):
    bpy.ops.object.light_add(type='AREA', location=position)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.data.color = color
    light.rotation_euler = (Vector((0, 0, 0)) - light.location).to_track_quat('-Z', 'Y').to_euler()


area('Softbox / upper left', (-3, 5, 7), 850, 5, (1.0, 0.91, 0.76))
area('Fill / cool right', (4, 0.7, 5), 480, 4, (0.8, 0.88, 1.0))
area('Edge / top', (0, 5, 2.2), 320, 3, (1, 0.98, 0.92))
bpy.ops.object.camera_add(location=(0.04, 0.02, 10))
camera = bpy.context.object
camera.name = 'Presentation / orthographic'
camera.rotation_euler = (0, 0, 0)
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 6.28
scene.camera = camera
scene.render.filepath = str(DOCS / 'cursor-models-preview.jpg')
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(DOCS / 'cursors.blend'), compress=True)
bpy.ops.render.render(write_still=True)
# A second render makes the actual exported shape-key deformation reviewable.
hand_obj.data.shape_keys.key_blocks['Grip'].value = 1
plane.location.z = -1.75
scene.render.filepath = str(DOCS / 'cursor-grip-preview.jpg')
bpy.ops.render.render(write_still=True)
hand_obj.data.shape_keys.key_blocks['Grip'].value = 0
print('CURSOR_BUILD_COMPLETE')
