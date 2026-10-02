# Marble journey sculptures

The transition posters combine two original procedural sculptures with a licensed Aristotle scan:

- **Shop:** an original carved human bust wearing a six-panel dad cap, with a curved visor, panel seams, button, eyelets and incised stitching.
- **Coach:** an adaptation of [“Aristotele bust” by nicola_scaramella](https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [source attribution, provenance and modifications](sources/ATTRIBUTION.md).
- **Feed:** original paired brain hemispheres with gyri, a central fissure, cerebellar folia, optic nerves, carved eyes and a supporting brain stem.

The original shop/feed geometry is authored in `build.py`. The coach anatomy comes from the actual scanned sculpture; `rebuild_coach.py` preserves the entire source and makes a separate display copy. It mildly enhances existing surface relief along the original normals (at most 0.3% of the bust's height), then conservatively decimates that copy. It does not add invented facial details or voxel-remesh the scan. The result is one connected watertight surface with outward normals, 90,002 vertices and 180,000 triangles. `sources/coach-validation.json` records the topology and baked color range.

## Rebuild

Requires Blender 5.1+ and `cwebp` (the WebP command-line encoder):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/journey-posters/build.py
```

To rebuild one sculpture, append `-- --only shop`, `-- --only coach`, or `-- --only feed`. The default build and the coach-only build both dispatch to the licensed scan pipeline; the rejected procedural philosopher has been removed. The source archive is checked against its documented SHA-256 before import.

To render a coach study without replacing browser assets:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup \
  --python scripts/journey-posters/rebuild_coach.py \
  -- --review-only --preview-dir /tmp/aristotle-review
```

The coach pipeline produces front, profile and three-quarter renders for inspection before export. Without `--preview-dir`, these working PNGs go into the system temporary directory under `aristotle-study/final/`. Review-only mode saves the editable `coach.blend` and validation report but leaves the GLB and WebP unchanged.

The checked-in `.blend` files include the display mesh, procedural material, camera and lights. `coach.blend` also includes the hidden original scan and source/license text. `contact-sheet.png` presents the current shop, coach and feed fallbacks. Reference screenshots are deliberately not packed or redistributed.

## Browser asset contract

`website/assets/journey/{shop,coach,feed}.glb` contains glTF 2.0 uncompressed triangle meshes, positions, normals and opaque material factors. No Draco, Meshopt, image texture or animation decoder is required. Each object is centered, approximately 3 units tall, Y-up and faces +Z. Blender authoring is Z-up/front -Y. The cap's visor and the brain's eyes extend toward +Z in the exported asset.

Coach also carries `COLOR_0`: linear grayscale local cavity shading, approximately 0.67–1.0, multiplied by a constant ivory `baseColorFactor`. This reveals existing eye sockets, hair folds and beard creases without baking directional lighting into the mesh. The attribute is baked on the separate export copy; no source texture maps are needed. The GLB has source attribution in `asset.copyright`.

Fine marble grain comes from the native WebGPU shader. The transparent WebP images are compact fallbacks rendered from the same meshes, used while a GPU asset loads or when WebGPU is unavailable. Only GLB and WebP assets belong in `website/assets/journey`; working PNGs and source files must stay outside the embedded runtime asset directory.

Blender renders are insufficient to validate browser geometry: also inspect the final GLB in Chrome with the real WebGPU shader, including front and side views, before publishing.
