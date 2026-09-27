# Marble journey sculptures

These are original, procedural Blender sculptures made for the transition posters.
The geometry is authored in `build.py`; no downloaded models, texture maps or
third-party Blender add-ons are used.

- **Shop:** a carved human bust wearing a six-panel dad cap, with a curved visor,
  panel seams, button, eyelets and incised stitching.
- **Coach:** a philosopher bust with ringlet hair and beard, a draped himation,
  carved eyes and an oval museum socle.
- **Feed:** paired brain hemispheres with continuous gyri, a central fissure,
  cerebellar folia, optic nerves, carved eyes and a supporting brain stem.

The facial surfaces and primary volumes are closed meshes. Voxel fusion joins
the raised surface details to their underlying marble volumes; a smoothing and
decimation pass produces approximately 88,000 triangles per sculpture. Normals
are recalculated outward and Blender validates the final mesh before export.

## Rebuild

Requires Blender 5.1+ and `cwebp` (the WebP command-line encoder):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/journey-posters/build.py
```

To revise one sculpture, append `-- --only shop` (or `coach`, `feed`). The checked-in
`.blend` files include the final editable mesh, procedural marble material,
portrait camera and studio lights. `contact-sheet.png` presents the three beauty
renders in shop, coach, feed order.

## Browser asset contract

`website/assets/journey/{shop,coach,feed}.glb` contains glTF 2.0 triangle meshes,
positions, normals and opaque material factors. No Draco, Meshopt, texture or
animation decoder is required. Each object is centered, 3 units tall, Y-up and
faces +Z. The cap's visor and the brain's eyes therefore extend toward +Z.

The glTF contains neutral ivory and recessed-stone materials. Blender's procedural
veining is recreated by the native WebGPU marble shader rather than shipping
baked texture maps. This lets lighting and surface grain remain consistent while
the object rotates. The transparent `{shop,coach,feed}.webp` images are compact
fallbacks rendered from these same meshes, used while a GPU asset loads or when
WebGPU is unavailable. Temporary lossless PNGs are removed after conversion.
