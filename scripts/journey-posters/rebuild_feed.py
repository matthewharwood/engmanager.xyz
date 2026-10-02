"""Sculpt the feed's marble brain in Blender from licensed human anatomy.

The preserved HRA source is CC BY 4.0. Cerebral lobes retain actual irregular
sulci; this pipeline consolidates internal segmentation, adds small blank stone
eyes and a short bust support, then bakes local cavity color. No runtime texture
or third-party rendering dependency is required. Coach assets are never written.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import rebuild_coach as studio

SOURCE_DIR = Path(__file__).resolve().parent
ROOT = SOURCE_DIR.parents[1]
RUNTIME_DIR = ROOT / 'website/assets/journey'
SOURCE_PATH = SOURCE_DIR / 'sources/hra-brain-male-v1.3.glb'
SOURCE_SHA256 = '2b9ad5b53e40e9f0936da74f7be38d2eed15604e26358c3870a0ea13499b9a35'
SOURCE_URL = 'https://lod.humanatlas.io/ref-organ/brain-male/v1.3/assets/3d-vh-m-allen-brain.glb'
COPYRIGHT = ('Adapted from "3D Reference Organ for Brain, Male v1.3" by Kristen Browne and Heidi Schlehlein. '
             'https://doi.org/10.48539/HBM929.XKCL.339 Licensed CC BY 4.0, '
             'https://creativecommons.org/licenses/by/4.0/. Changes: anatomical surface consolidation, '
             'orientation, normalization, conservative smoothing and decimation, marble material, '
             'vertex cavity shading; original carved eyes and short bust support added.')


def activate(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.hide_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def clean(obj):
    activate(obj)
    obj.data.validate(clean_customdata=True)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.000003)
    bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.000002)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    for face in obj.data.polygons:
        face.use_smooth = True


def join(objects, name):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    obj.name = name
    return obj


def consolidate(objects, name, voxel=0.0065, smooth=3):
    obj = join(objects, name)
    activate(obj)
    remesh = obj.modifiers.new('Consolidate atlas segmentation without inventing folds', 'REMESH')
    remesh.mode = 'VOXEL'
    remesh.voxel_size = voxel
    remesh.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    modifier = obj.modifiers.new('Lightly dressed marble surface', 'SMOOTH')
    modifier.factor = 0.62
    modifier.iterations = smooth
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    clean(obj)
    return obj


def remove_detached_fragments(obj):
    # Tiny disconnected atlas labels can survive the volume union. The intended
    # museum object is one connected stone surface; preserve the largest island
    # and retain the untouched anatomy in the hidden source collection.
    bm=bmesh.new();bm.from_mesh(obj.data)
    unseen=set(bm.verts);islands=[]
    while unseen:
        seed=unseen.pop();stack=[seed];island=[seed]
        while stack:
            vertex=stack.pop()
            for edge in vertex.link_edges:
                neighbor=edge.other_vert(vertex)
                if neighbor in unseen:
                    unseen.remove(neighbor);stack.append(neighbor);island.append(neighbor)
        islands.append(island)
    islands.sort(key=len,reverse=True)
    discarded=[vertex for island in islands[1:] for vertex in island]
    if len(discarded)>len(bm.verts)*.02:
        raise RuntimeError('An intended sculptural part is disconnected; reposition it before export.')
    if discarded:bmesh.ops.delete(bm,geom=discarded,context='VERTS')
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    return len(discarded)


def make_mesh(name, vertices, faces, collection):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    collection.objects.link(obj)
    clean(obj)
    return obj


def ellipsoid(name, center, scale, collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=64, ring_count=40, radius=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    studio.move_to(obj, collection)
    clean(obj)
    return obj


def tube(name, points, radius, collection):
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    curve.use_fill_caps = True
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for dest, coord in zip(spline.points, points):
        dest.co = (*coord, 1)
    obj = bpy.data.objects.new(name, curve)
    collection.objects.link(obj)
    activate(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def add_support(collection):
    # A cropped bust, not a thin specimen stand: gently planar lower sections,
    # blunt shoulder edges, and two quiet collarbone planes cut into the front.
    sections = [(-1.50, .83, .42, .10, .74), (-1.48, .85, .44, .10, .76),
                (-1.35, .90, .47, .12, .82), (-1.19, .94, .48, .14, .90),
                (-1.08, .89, .46, .17, .95), (-.96, .71, .425, .18, 1),
                (-.82, .49, .36, .21, 1), (-.67, .34, .305, .24, 1),
                (-.52, .28, .27, .26, 1)]
    rows=[]
    for a,b in zip(sections,sections[1:]):
        count=max(2,round((b[0]-a[0])/.025))
        for step in range(count):
            t=step/count
            rows.append(tuple(x+(y-x)*t for x,y in zip(a,b)))
    rows.append(sections[-1])
    vertices=[]
    sides=96
    for z,width,depth,center_y,exponent in rows:
        for i in range(sides):
            angle=2*math.pi*i/sides
            cosine,sine=math.cos(angle),math.sin(angle)
            x=width*math.copysign(abs(cosine)**exponent,cosine)
            y=center_y+depth*math.copysign(abs(sine)**exponent,sine)
            front=max(0,-sine)**8
            # These reliefs are broad and shallow, like chisel planes rather
            # than raised tubular bones or an invented face under the brain.
            collar_z=-.965-.22*abs(x)
            ridge=.028*math.exp(-((z-collar_z)/.055)**2)*min(1,abs(x)/.14)
            notch=.020*math.exp(-(x/.13)**2-((z+.93)/.12)**2)
            y+=front*(notch-ridge)
            vertices.append((x,y,z))
    faces=[]
    for row in range(len(rows)-1):
        for i in range(sides):
            a=row*sides+i; b=row*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces += [tuple(range(sides-1,-1,-1)),tuple((len(rows)-1)*sides+i for i in range(sides))]
    obj=make_mesh('Short broad cropped marble bust support',vertices,faces,collection)
    activate(obj)
    modifier=obj.modifiers.new('Soft chisel transitions', 'SUBSURF')
    modifier.subdivision_type='CATMULL_CLARK';modifier.levels=2
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def add_eyes(collection):
    eyes=[]
    for sign in (-1,1):
        # A shallow almond relief is inset beneath the orbitofrontal surface;
        # no stalks, colored iris rings or freestanding cartoon spheres.
        cx=sign*.34; cy=-.81; cz=-.015
        eye=ellipsoid(('Left' if sign<0 else 'Right')+' blank carved eye',
                      (cx,cy,cz),(.188,.078,.108),collection)
        eyes.append(eye)
        for upper in (True,False):
            pts=[]
            for i in range(49):
                t=i/48; x=-.182+.364*t
                z=(.065 if upper else -.050)*math.sin(math.pi*t)
                y=(-.007 if upper else .003)-.051*math.sin(math.pi*t)
                pts.append((cx+x,cy+y,cz+z))
            eyes.append(tube(('Upper' if upper else 'Lower')+' carved eyelid',pts,.009 if upper else .0045,collection))
        # A small stone bridge blends the lids into the cortex, hiding the rear
        # half of each eye and giving the sculptor a credible load-bearing form.
        eyes.append(ellipsoid('Orbital stone bridge',(cx,cy+.185,cz+.045),(.19,.145,.105),collection))
    return eyes


def prepare():
    data=SOURCE_PATH.read_bytes()
    if hashlib.sha256(data).hexdigest()!=SOURCE_SHA256:
        raise ValueError('HRA source differs from the documented immutable download.')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(SOURCE_PATH))
    meshes=[obj for obj in bpy.data.objects if obj.type=='MESH']
    preserved=studio.collection('Feed — preserved HRA brain source')
    for obj in list(bpy.data.objects): studio.move_to(obj,preserved)
    display=studio.collection('Feed — carved marble study')
    all_points=[obj.matrix_world @ v.co for obj in meshes for v in obj.data.vertices]
    low=Vector(tuple(min(p[i] for p in all_points) for i in range(3)))
    high=Vector(tuple(max(p[i] for p in all_points) for i in range(3)))
    center=(low+high)/2
    scale=2.18/(high.z-low.z)
    groups={'left':[],'right':[],'lower':[]}
    for source in meshes:
        name=source.name.lower()
        # Ventricles/canals are atlas labels for empty spaces, not positive
        # stone anatomy. Omit those internal labels from the surface union.
        if 'ventricle' in name or 'aqueduct' in name or 'canal' in name: continue
        obj=bpy.data.objects.new(source.name+' — marble surface',source.data.copy())
        display.objects.link(obj)
        for vertex, original in zip(obj.data.vertices,source.data.vertices):
            p=(source.matrix_world @ original.co-center)*scale
            vertex.co=(p.x,p.y,p.z+.39)
        lower=any(word in name for word in ['cerebell','hindbrain','pons','pontine','medulla','peduncle','midbrain','nigra','colliculus','pretectal'])
        key='lower' if lower else 'left' if name.endswith('_l') else 'right'
        groups[key].append(obj)
    preserved.hide_viewport=True;preserved.hide_render=True
    for obj in preserved.objects:obj.hide_set(True)
    left=consolidate(groups['left'],'Left cerebral hemisphere — actual gyri')
    right=consolidate(groups['right'],'Right cerebral hemisphere — actual gyri')
    lower=consolidate(groups['lower'],'Cerebellum and restrained brainstem',voxel=.0065,smooth=2)
    support=add_support(display)
    eyes=add_eyes(display)
    # Preserve the major longitudinal fissure by not fusing the hemispheres
    # across their medial walls; connected lower support joins the sculpture.
    joined=join([left,right,lower,support,*eyes],'Feed — brain with carved eyes')
    activate(joined)
    # Light final union joins the carved additions and removes hidden overlaps.
    final=consolidate([joined],'Feed — cerebral marble portrait',voxel=.0055,smooth=2)
    final.data.calc_loop_triangles()
    count=len(final.data.loop_triangles)
    if count>180000:
        dec=final.modifiers.new('Browser sculpture detail budget','DECIMATE')
        dec.ratio=180000/count;dec.use_collapse_triangulate=True
        bpy.ops.object.modifier_apply(modifier=dec.name)
    clean(final)
    fragments=remove_detached_fragments(final)
    final['discarded_detached_vertices']=fragments
    # Exact centered 3-unit runtime contract, preserving proportions.
    points=np.array([v.co[:] for v in final.data.vertices])
    lo,hi=points.min(axis=0),points.max(axis=0)
    points=(points-(lo+hi)/2)*(3/(hi[2]-lo[2]))
    final.data.vertices.foreach_set('co',points.ravel());final.data.update()
    final.data.materials.clear();final.data.materials.append(studio.marble_material())
    final['attribution']=COPYRIGHT
    final['source_sha256']=SOURCE_SHA256
    return final


def save_blend(obj):
    activate(obj)
    scene=bpy.context.scene
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                region=area.spaces.active.region_3d
                region.view_distance=5
                region.view_location=(0,0,0)
                region.view_rotation=scene.camera.rotation_euler.to_quaternion()
    text=bpy.data.texts.new('FEED SOURCE AND LICENSE')
    text.write(COPYRIGHT+'\n\nSource: '+SOURCE_URL+'\nSHA-256: '+SOURCE_SHA256+'\n')
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE_DIR/'feed.blend'),compress=True)


def export(obj):
    material=obj.data.materials[0]
    runtime=bpy.data.materials.new('Feed — same honed ivory as Aristotle')
    runtime.use_nodes=True;runtime.diffuse_color=(.62,.60,.56,1)
    bsdf=runtime.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=runtime.diffuse_color
    bsdf.inputs['Roughness'].default_value=.56
    bsdf.inputs['Metallic'].default_value=0
    runtime.use_backface_culling=True
    obj.data.materials[0]=runtime
    activate(obj)
    try:
        bpy.ops.export_scene.gltf(filepath=str(RUNTIME_DIR/'feed.glb'),export_format='GLB',
            use_selection=True,export_yup=True,export_texcoords=False,export_normals=True,
            export_materials='EXPORT',export_vertex_color='ACTIVE',export_cameras=False,
            export_lights=False,export_animations=False,export_attributes=False,export_copyright=COPYRIGHT)
    finally:
        obj.data.materials[0]=material;bpy.data.materials.remove(runtime)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--review-only',action='store_true')
    parser.add_argument('--preview-dir',type=Path,default=Path(tempfile.gettempdir())/'feed-study/final')
    args=parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    obj=prepare()
    report=studio.topology_report(obj)
    if report['boundary_edges'] or report['nonmanifold_edges'] or report['signed_volume']<=0:
        raise RuntimeError(f'Invalid sculptural surface: {report}')
    studio.setup_studio()
    cavity=studio.bake_cavity(obj)
    studio.render_review(args.preview_dir)
    save_blend(obj)
    if not args.review_only:
        export(obj)
        encoder=shutil.which('cwebp')
        if not encoder:raise RuntimeError('cwebp is required to package the sculpture fallback.')
        subprocess.run([encoder,'-quiet','-q','86','-alpha_q','100','-m','6',str(args.preview_dir/'three-quarter.png'),'-o',str(RUNTIME_DIR/'feed.webp')],check=True)
    result={'source':SOURCE_URL,'source_sha256':SOURCE_SHA256,'copyright':COPYRIGHT,'export':report,'linear_cavity':cavity}
    (SOURCE_DIR/'sources/feed-validation.json').write_text(json.dumps(result,indent=2)+'\n')
    print('FEED_STUDY',json.dumps(result),flush=True)


if __name__=='__main__':main()
