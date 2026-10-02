"""Original marble studies for the journey posters. Run with Blender 5.1+.

    blender --background --factory-startup --python scripts/journey-posters/build.py

Shop and feed are authored here. Coach uses the licensed Aristotle scan and
rebuild_coach.py; see sources/ATTRIBUTION.md for provenance and reuse terms.
The exported glTF is Y-up, faces +Z, and uses only uncompressed triangle meshes.
"""

import argparse
import math
import random
import shutil
import subprocess
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "website/assets/journey"
SOURCE = Path(__file__).resolve().parent
TAU = math.tau
random.seed(41)


def material(name, color, roughness=0.57, marble=False):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Subsurface Weight"].default_value = 0.035
    if marble:
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        coord = nodes.new("ShaderNodeTexCoord")
        noise = nodes.new("ShaderNodeTexNoise")
        noise.inputs["Scale"].default_value = 3.1
        noise.inputs["Detail"].default_value = 5
        noise.inputs["Roughness"].default_value = 0.72
        links.new(coord.outputs["Generated"], noise.inputs["Vector"])
        wave = nodes.new("ShaderNodeTexWave")
        wave.wave_type = "BANDS"
        wave.bands_direction = "DIAGONAL"
        wave.inputs["Scale"].default_value = 4.6
        wave.inputs["Distortion"].default_value = 17.2
        wave.inputs["Detail"].default_value = 5
        links.new(coord.outputs["Generated"], wave.inputs["Vector"])
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.elements[0].position = 0.006
        ramp.color_ramp.elements[0].color = (0.65, 0.61, 0.53, 1)
        ramp.color_ramp.elements[1].position = 0.045
        ramp.color_ramp.elements[1].color = (*color, 1)
        links.new(wave.outputs["Color"], ramp.inputs["Fac"])
        links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
        grain = nodes.new("ShaderNodeTexNoise")
        grain.inputs["Scale"].default_value = 180
        grain.inputs["Detail"].default_value = 2
        links.new(coord.outputs["Generated"], grain.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.11
        bump.inputs["Distance"].default_value = 0.009
        links.new(grain.outputs["Fac"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


MARBLE = material("Honed Pentelic marble", (0.79, 0.745, 0.635), marble=True)
PALE = material("Freshly carved stone", (0.88, 0.845, 0.755), 0.49, True)
CUT = material("Recessed stone", (0.38, 0.355, 0.29), 0.7, True)
MODEL_OBJECTS = []


def remember(obj, mat=MARBLE):
    obj.data.materials.append(mat)
    MODEL_OBJECTS.append(obj)
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True
    return obj


def mesh(name, verts, faces, mat=MARBLE):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    return remember(obj, mat)


def sphere(name, loc, scale, mat=MARBLE, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return remember(obj, mat)


def tube(name, points, radius, mat=MARBLE, resolution=6, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.resolution_u = resolution
    spline = curve.splines.new("POLY")
    spline.points.add(len(points)-1)
    for vert, co in zip(spline.points, points):
        vert.co = (*co[:3], 1)
        if len(co) > 3:
            vert.radius = co[3]
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return remember(obj, mat)


def gauss(x, z, cx, cz, wx, wz):
    return math.exp(-((x-cx)/wx)**2-((z-cz)/wz)**2)


def profile(t, samples):
    for (a, va), (b, vb) in zip(samples, samples[1:]):
        if a <= t <= b:
            q = (t-a)/(b-a)
            q = q*q*(3-2*q)
            return va*(1-q)+vb*q
    return samples[0][1] if t < samples[0][0] else samples[-1][1]


def face():
    verts, faces = [], []
    rows, cols = 96, 128
    for i in range(rows+1):
        t = i/rows
        z = 1.08+t*1.73
        width = profile(t, [(0,.06),(.07,.29),(.17,.43),(.3,.52),(.46,.61),(.64,.6),(.8,.55),(.92,.4),(1,.01)])
        depth = profile(t, [(0,.08),(.08,.29),(.23,.43),(.5,.5),(.74,.54),(.9,.4),(1,.01)])
        for j in range(cols):
            phi = TAU*j/cols
            x = width*math.sin(phi)
            front = max(0,math.cos(phi))**4
            y = -depth*math.cos(phi)
            relief = .095*gauss(x,z,0,1.29,.29,.13)
            relief += .065*gauss(x,z,0,1.52,.28,.19)
            relief += .23*gauss(x,z,0,1.99,.113,.30)
            relief += .20*gauss(x,z,0,1.79,.14,.10)
            relief += .085*gauss(x,z,0,2.26,.14,.12)
            for sign in [-1,1]:
                relief += .12*gauss(x,z,sign*.36,1.91,.19,.17)
                relief += .075*gauss(x,z,sign*.3,2.25,.22,.09)
                relief -= .095*gauss(x,z,sign*.275,2.115,.17,.082)
                relief -= .065*gauss(x,z,sign*.37,1.57,.15,.22)
                relief += .045*gauss(x,z,sign*.11,1.75,.065,.056)
            y -= relief*front
            y += .10*(1-t)**3
            verts.append((x,y,z))
    for i in range(rows):
        for j in range(cols):
            a = i*cols+j
            b = i*cols+(j+1)%cols
            faces.append((a,b,b+cols,a+cols))
    faces.append(tuple(range(cols-1,-1,-1)))
    faces.append(tuple(rows*cols+j for j in range(cols)))
    obj = mesh("Continuous sculpted face and cranium",verts,faces)
    # Marble eyes are deliberately unpainted; concentric shallow cuts read as carving.
    for sign in [-1,1]:
        cx, cy, cz = sign*.273,-.48,2.115
        sphere("Carved eye",(cx,cy,cz),(.151,.102,.079),PALE)
        for upper in [True,False]:
            pts=[]
            for i in range(33):
                t=i/32
                x=cx+(t-.5)*.323
                z=cz+(math.sin(math.pi*t)*(.084 if upper else -.063))+(t-.5)*sign*.025
                y=cy-.035-.071*math.sin(math.pi*t)
                pts.append((x,y,z,.45+.55*math.sin(math.pi*t)))
            tube("Upper eyelid" if upper else "Lower eyelid",pts,.021 if upper else .015)
        sphere("Pupil relief",(cx,cy-.105,cz),(.019,.003,.019),CUT,24,12)
        pts=[]
        for i in range(33):
            t=i/32
            pts.append((sign*(.10+.40*t),-.51-.047*math.sin(math.pi*t),2.24+.064*math.sin(math.pi*t)-.025*t,.5+.5*math.sin(math.pi*t)))
        tube("Supraorbital ridge",pts,.039)
        # Nostril rim and cavity are small: the underlying nose is part of the face mesh.
        sphere("Nostril shadow",(sign*.095,-.735,1.753),(.038,.015,.018),CUT,24,12)
        tube("Nostril wing",[(sign*(.055+.073*math.sin(math.pi*i/20)),-.717-.033*math.sin(math.pi*i/20),1.763+.047*math.sin(math.pi*i/20)) for i in range(21)],.020)
        sphere("Ear concha",(sign*.58,.008,2.015),(.096,.10,.175))
        tube("Ear helix",[(sign*(.594+.045*math.cos(TAU*i/64)), -.069-.028*math.sin(TAU*i/64), 2.022+.143*math.sin(TAU*i/64)) for i in range(65)],.022)
        tube("Ear antihelix",[(sign*(.614+.015*math.cos(math.pi*i/32)), -.087, 1.96+.13*i/32) for i in range(33)],.017)
    upper=[];lower=[];cleft=[]
    for i in range(65):
        t=i/64; x=(t-.5)*.40
        fullness=math.sin(math.pi*t)
        cupid=.018*math.cos(x/.20*math.pi*2)*fullness
        upper.append((x,-.51-.038*fullness,1.514+cupid,.22+.78*fullness))
        lower.append((x,-.519-.041*fullness,1.470-.013*fullness,.2+.8*fullness))
        cleft.append((x,-.55-.008*fullness,1.491,.2+.8*fullness))
    tube("Upper lip",upper,.021)
    tube("Lower lip",lower,.026)
    tube("Closed mouth incision",cleft,.006,CUT)
    return obj


def torso():
    verts,faces=[],[]
    rows,cols=40,96
    for i in range(rows+1):
        t=i/rows
        z=-.50+1.86*t
        w=profile(t,[(0,.50),(.10,.66),(.25,.90),(.46,1.0),(.56,.76),(.69,.38),(.82,.285),(1,.25)])
        d=profile(t,[(0,.22),(.2,.34),(.43,.38),(.6,.30),(.76,.26),(1,.29)])
        for j in range(cols):
            p=TAU*j/cols
            x=w*math.sin(p)
            y=-d*math.cos(p)+.045
            y-=.045*math.exp(-((t-.54)/.1)**2)*max(0,math.cos(p))
            verts.append((x,y,z))
    for i in range(rows):
        for j in range(cols):
            a=i*cols+j;b=i*cols+(j+1)%cols
            faces.append((a,b,b+cols,a+cols))
    faces.append(tuple(range(cols-1,-1,-1)))
    faces.append(tuple(rows*cols+j for j in range(cols)))
    mesh("Shoulders, collar bones and tapered museum bust",verts,faces)
    for sign in [-1,1]:
        tube("Sternocleidomastoid",[(sign*(.22+.04*i/32),-.19-.06*i/32,1.18-.59*i/32,.4+.35*math.sin(math.pi*i/32)) for i in range(33)],.035)
        tube("Clavicle",[(sign*(.06+.67*i/40),-.321+.05*i/40,.53-.065*math.sin(math.pi*i/40),.3+.7*math.sin(math.pi*i/40)) for i in range(41)],.030)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=1,depth=.16,location=(0,0,-.61))
    plinth=bpy.context.object;plinth.name="Oval museum socle";plinth.scale=(.57,.39,1)
    bevel=plinth.modifiers.new("Chisel softened edge","BEVEL");bevel.width=.022;bevel.segments=3
    remember(plinth)


def cap():
    first_cap_object=len(MODEL_OBJECTS)
    verts,faces=[],[]
    rows,cols=28,96
    for i in range(rows+1):
        a=(.012+(math.pi/2-.012)*i/rows)
        for j in range(cols):
            p=TAU*j/cols
            seam=1+.006*math.cos(6*p)
            verts.append((.683*math.sin(a)*math.sin(p)*seam,-.577*math.sin(a)*math.cos(p)*seam+.025,2.30+.58*math.cos(a)))
    for i in range(rows):
        for j in range(cols):
            a=i*cols+j;b=i*cols+(j+1)%cols
            faces.append((a,b,b+cols,a+cols))
    crown=mesh("Six-panel dad cap carved from solid stone",verts,[tuple(reversed(f)) for f in faces])
    solid=crown.modifiers.new("Crown edge thickness","SOLIDIFY");solid.thickness=.025
    for k in range(6):
        p=TAU*k/6
        tube("Cap panel seam",[(.687*math.sin(a)*math.sin(p),-.581*math.sin(a)*math.cos(p)+.025,2.3+.584*math.cos(a)) for a in [.07+i*(math.pi/2-.07)/40 for i in range(41)]],.0085)
    tube("Cap lower welt",[(.684*math.sin(p),-.578*math.cos(p)+.025,2.30) for p in [TAU*i/96 for i in range(97)]],.018)
    # Crescent brim, with transverse camber and a beveled, polished outer edge.
    verts,faces=[],[]
    for i in range(17):
        t=i/16
        for j in range(65):
            u=(j/64-.5)*2
            x=(.602+.106*t)*u
            back=-.20-.355*math.sqrt(max(0,1-u*u))
            y=back-t*.50*(1-.25*u*u)
            z=2.299-.12*t+.105*u*u
            verts.append((x,y,z))
    for i in range(16):
        for j in range(64):
            a=i*65+j;faces.append((a,a+1,a+66,a+65))
    brim=mesh("Curved dad cap visor",verts,[tuple(reversed(f)) for f in faces])
    solid=brim.modifiers.new("Carved visor thickness","SOLIDIFY");solid.thickness=.047
    bevel=brim.modifiers.new("Soft visor edge","BEVEL");bevel.width=.018;bevel.segments=3
    for line in [.72,.85]:
        pts=[]
        for j in range(65):
            u=(j/64-.5)*2
            pts.append(((.602+.106*line)*u,-.20-.355*math.sqrt(max(0,1-u*u))-line*.50*(1-.25*u*u),2.306-.12*line+.105*u*u))
        tube("Incised visor stitching",pts,.0038,CUT)
    sphere("Covered cap button",(0,.025,2.89),(.052,.052,.020))
    for sign in [-1,1]:
        sphere("Cap ventilation eyelet",(sign*.53,-.321,2.55),(.015,.01,.015),CUT,20,12)
    for part in MODEL_OBJECTS[first_cap_object:]:
        part.location.z+=.12


def brain():
    # Two hemispheres, a deep longitudinal fissure and continuous serpentine gyri.
    for sign in [-1,1]:
        sphere("Cerebral hemisphere",(sign*.43,.08,1.10),(.66,.76,.77),MARBLE,64,40)
        for band in range(9):
            lat=-1.16+band*.27
            pts=[]
            for i in range(220):
                t=i/219
                a=-math.pi+t*TAU
                wobble=.094*math.sin(a*7.2+band*2.0)+.049*math.sin(a*14.3+band*.7)
                b=lat+wobble*math.cos(lat)
                x=sign*(.42+.652*math.cos(b)*math.cos(a))
                y=.08+.757*math.cos(b)*math.sin(a)
                z=1.10+.76*math.sin(b)
                pts.append((x,y,z,.90+.10*math.sin(t*17+band)))
            tube("Continuous cerebral gyrus",pts,.073+random.random()*.012)
        # Medial crown convolutions curl toward, but never bridge, the central fissure.
        for k in range(6):
            pts=[]
            for i in range(80):
                t=i/79
                y=-.46+k*.205+.046*math.sin(t*TAU*2+k)
                x=sign*(.13+t*.50)
                z=1.10+.735*math.sqrt(max(.02,1-((x-sign*.43)/.66)**2-((y-.08)/.84)**2))
                pts.append((x,y,z))
            tube("Superior convolution",pts,.072)
    # Low cerebellum with finer, horizontal folia, and a clean sculptural brain stem.
    sphere("Cerebellum",(0,.38,.38),(.60,.47,.34),MARBLE,48,24)
    for j in range(10):
        z=.18+j*.042
        r=math.sqrt(max(.10,1-((z-.38)/.35)**2))
        pts=[(.595*r*math.cos(TAU*i/96),.38+.47*r*math.sin(TAU*i/96),z) for i in range(97)]
        tube("Cerebellar folium",pts,.018)
    tube("Medulla and spinal stem",[(.025*math.sin(t*math.pi),.24+.07*t,.45-.94*t,1-.28*t) for t in [i/60 for i in range(61)]],.15)
    for sign in [-1,1]:
        tube("Optic nerve",[(sign*(.21+.27*t),-.42-.50*t,.47+.09*t,1-.15*t) for t in [i/40 for i in range(41)]],.049)
        cx=sign*.48;cy=-1.02;cz=.56
        sphere("Marble eyeball",(cx,cy,cz),(.225,.225,.225),PALE,56,32)
        sphere("Carved iris disk",(cx,cy-.216,cz),(.093,.018,.093),MARBLE,48,24)
        tube("Iris carved outer rim",[(cx+.095*math.cos(TAU*i/64),cy-.218,cz+.095*math.sin(TAU*i/64)) for i in range(65)],.009,CUT)
        for k in range(32):
            a=TAU*k/32
            tube("Radial iris chisel cut",[(cx+r*math.cos(a),cy-.235,cz+r*math.sin(a)) for r in [.046,.052,.071,.082]],.002,CUT)
        sphere("Recessed pupil",(cx,cy-.237,cz),(.044,.006,.044),CUT,32,16)
    bpy.ops.mesh.primitive_cylinder_add(vertices=96,radius=.46,depth=.14,location=(0,.23,-.52))
    pedestal=bpy.context.object;pedestal.name="Brain oval socle";pedestal.scale.y=.74
    bevel=pedestal.modifiers.new("Socle bevel","BEVEL");bevel.width=.02;bevel.segments=3
    remember(pedestal)


def aim(obj, point):
    obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()


def setup_render():
    scene=bpy.context.scene
    scene.render.engine='CYCLES'
    scene.cycles.samples=48
    scene.cycles.use_denoising=True
    scene.render.resolution_x=900
    scene.render.resolution_y=1050
    scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'
    scene.render.image_settings.color_mode='RGBA'
    scene.render.film_transparent=True
    scene.world.color=(.12,.12,.12)
    scene.view_settings.view_transform='AgX'
    bpy.ops.object.camera_add(location=(2.1,-8.0,1.25))
    camera=bpy.context.object;camera.name="Museum portrait camera";camera.data.type='ORTHO';camera.data.ortho_scale=4.05
    aim(camera,(0,0,0));scene.camera=camera
    for name,loc,power,size,color in [
        ("Large softbox",(-3.8,-4.0,5.0),520,4.0,(1.0,.91,.77)),
        ("Cool fill",(4,-2,1),180,3.0,(.75,.84,1.0)),
        ("Marble rim",(1,3,4),720,3,(1,.95,.86)),
    ]:
        bpy.ops.object.light_add(type='AREA',location=loc)
        light=bpy.context.object;light.name=name;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.data.color=color;aim(light,(0,0,0))


def finalize(kind):
    global MODEL_OBJECTS
    bpy.ops.object.select_all(action='DESELECT')
    for obj in MODEL_OBJECTS:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=MODEL_OBJECTS[0]
    bpy.ops.object.convert(target='MESH')
    objects=list(bpy.context.selected_objects)
    # Voxel fusion makes the raised locks, lips and gyri part of a continuous carving.
    # Incision accents stay independent so they retain their dark recessed material.
    body=[o for o in objects if o.data.materials[0] != CUT]
    accents=[o for o in objects if o.data.materials[0] == CUT]
    bpy.ops.object.select_all(action='DESELECT')
    for part in body: part.select_set(True)
    bpy.context.view_layer.objects.active=body[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    remesh=obj.modifiers.new("Fuse sculpted marble forms","REMESH")
    remesh.mode='VOXEL';remesh.voxel_size=.011;remesh.use_smooth_shade=True
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    smooth=obj.modifiers.new("Fine wet-sanded carving","SMOOTH")
    smooth.factor=.58;smooth.iterations=3
    bpy.ops.object.modifier_apply(modifier=smooth.name)
    for part in accents: part.select_set(True)
    bpy.context.view_layer.objects.active=obj
    bpy.ops.object.join()
    obj.name=kind.capitalize()+" — original marble study"
    bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
    coords=[v.co for v in obj.data.vertices]
    low=Vector(tuple(min(c[a] for c in coords) for a in range(3)))
    high=Vector(tuple(max(c[a] for c in coords) for a in range(3)))
    center=(low+high)/2
    scale=3/(high.z-low.z)
    for vertex in obj.data.vertices:
        vertex.co=(vertex.co-center)*scale
    dec=obj.modifiers.new("Export surface budget","DECIMATE")
    dec.ratio=min(1,44000/max(1,len(obj.data.polygons)))
    bpy.ops.object.modifier_apply(modifier=dec.name)
    tri=obj.modifiers.new("glTF triangles","TRIANGULATE")
    bpy.ops.object.modifier_apply(modifier=tri.name)
    obj.data.validate(verbose=False)
    bm=bmesh.new();bm.from_mesh(obj.data)
    bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    # glTF has a portable constant ivory surface; the WebGPU shader recreates marble.
    original_links=[]
    for mat in obj.data.materials:
        bsdf=mat.node_tree.nodes.get("Principled BSDF")
        for link in list(bsdf.inputs['Base Color'].links):
            original_links.append((mat,link.from_socket,link.to_socket))
            mat.node_tree.links.remove(link)
    bpy.ops.export_scene.gltf(filepath=str(OUT/(kind+".glb")),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=False,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_animations=False,export_attributes=False)
    for mat,from_socket,to_socket in original_links:
        mat.node_tree.links.new(from_socket,to_socket)
    setup_render()
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True);bpy.context.view_layer.objects.active=obj
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.region_3d.view_distance=5.5
                area.spaces.active.region_3d.view_location=(0,0,0)
                area.spaces.active.region_3d.view_rotation=bpy.context.scene.camera.rotation_euler.to_quaternion()
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE/(kind+".blend")),compress=True)
    bpy.context.scene.render.filepath=str(OUT/(kind+".png"))
    bpy.ops.render.render(write_still=True)
    print(f"POSTER_ASSET {kind}: {len(obj.data.vertices)} vertices, {len(obj.data.polygons)} triangles, {(OUT/(kind+'.glb')).stat().st_size} bytes",flush=True)


def package_stills():
    """Ship compact WebP fallbacks and rebuild the review sheet from all three."""
    import numpy as np
    kinds=['shop','coach','feed']
    encoder=shutil.which('cwebp')
    if not encoder:
        raise RuntimeError('Install cwebp (brew install webp) to package fallback images.')
    for kind in kinds:
        png=OUT/(kind+'.png')
        if png.exists():
            subprocess.run([encoder,'-quiet','-q','86','-alpha_q','100','-m','6',str(png),'-o',str(OUT/(kind+'.webp'))],check=True)
            png.unlink()
    sources=[OUT/(kind+'.webp') for kind in kinds]
    if all(path.exists() for path in sources):
        canvas=np.ones((1050,2700,4),dtype=np.float32)
        canvas[:,:,:3]=(.018,.021,.027)
        for index,path in enumerate(sources):
            img=bpy.data.images.load(str(path),check_existing=False)
            img.scale(900,1050)
            pixels=np.empty(900*1050*4,dtype=np.float32)
            img.pixels.foreach_get(pixels)
            pixels=pixels.reshape((1050,900,4))
            alpha=pixels[:,:,3:4]
            canvas[:,index*900:(index+1)*900,:3]=pixels[:,:,:3]*alpha+canvas[:,index*900:(index+1)*900,:3]*(1-alpha)
            bpy.data.images.remove(img)
        sheet=bpy.data.images.new('Marble studies — shop, coach, feed',width=2700,height=1050,alpha=False)
        sheet.pixels.foreach_set(canvas.ravel())
        sheet.filepath_raw=str(SOURCE/'contact-sheet.png')
        sheet.file_format='PNG';sheet.save()


def main():
    import sys
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    parser=argparse.ArgumentParser()
    parser.add_argument('--only',choices=['shop','coach','feed'])
    opts=parser.parse_args(args)
    OUT.mkdir(parents=True,exist_ok=True)
    global MODEL_OBJECTS
    for kind in ['shop','coach','feed']:
        if opts.only and kind!=opts.only:
            continue
        if kind=='coach':
            subprocess.run([bpy.app.binary_path, '--background', '--factory-startup',
                            '--python', str(SOURCE/'rebuild_coach.py')], check=True)
            continue
        bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
        MODEL_OBJECTS=[]
        random.seed(41)
        if kind=='feed':
            brain()
        else:
            torso();face();cap()
        finalize(kind)
    package_stills()


if __name__=='__main__':
    main()
