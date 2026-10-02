# Marble journey sculptures

The transition posters form one marble sculpture series, using licensed anatomy and a shared ivory material, portrait studio, scale and WebGPU shader:

- **Shop:** the same bearded Aristotle portrait as coaching, fitted with an original six-panel dad cap. The low crown, curved visor, seams, stitching, ventilation eyelets and rear adjustment strap are modeled in Blender. The cap-covered scalp is fitted inside the crown; the visible face, beard and cropped bust retain the accepted scan.
- **Coach:** an adaptation of [“Aristotele bust” by nicola_scaramella](https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). See [source attribution, provenance and modifications](sources/ATTRIBUTION.md).
- **Feed:** a marble adaptation of the [Human Reference Atlas Brain, Male v1.3](https://doi.org/10.48539/HBM929.XKCL.339), by Kristen Browne and Heidi Schlehlein, licensed CC BY 4.0. Its real anatomical folds are paired with original carved eyes and a short museum support.

`build.py` dispatches to `rebuild_shop.py`, `rebuild_coach.py` and `rebuild_feed.py`. The rejected procedural face and repeating brain-wave geometry have been removed. Each pipeline retains its source separately from the export and records geometry and baked color validation under `sources/`.

The coaching sculpture remains the accepted 90,002-vertex, 180,000-triangle scan adaptation. `rebuild_coach.py` preserves the entire scan and mildly enhances existing relief (at most 0.3% of the bust's height) on a separate display copy. Shop reads the accepted Blender file without rewriting it. Use `--only shop` or `--only feed` when changing those models so the accepted coaching assets stay untouched.

## Rebuild

Requires Blender 5.1+ and `cwebp` (the WebP command-line encoder):

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python-exit-code 1 \
  --python scripts/journey-posters/build.py
```

To rebuild one sculpture, append `-- --only shop`, `-- --only coach`, or `-- --only feed`. To refresh only the three-sculpture comparison, append `-- --sheet-only`. Source provenance and redistribution credits are documented in [sources/ATTRIBUTION.md](sources/ATTRIBUTION.md).

To render a coach study without replacing browser assets:

```sh
/Applications/Blender.app/Contents/MacOS/Blender \
  --background --factory-startup --python-exit-code 1 \
  --python scripts/journey-posters/rebuild_coach.py \
  -- --review-only --preview-dir /tmp/aristotle-review
```

The coach pipeline produces front, profile and three-quarter renders for inspection before export. Without `--preview-dir`, these working PNGs go into the system temporary directory under `aristotle-study/final/`. Review-only mode saves the editable `coach.blend` and validation report but leaves the GLB and WebP unchanged.

The checked-in `.blend` files include the display mesh, procedural material, camera and lights. `coach.blend` also includes the hidden original scan and source/license text. `contact-sheet.png` presents the current shop, coach and feed fallbacks. Reference screenshots are deliberately not packed or redistributed.

## Browser asset contract

`website/assets/journey/{shop,coach,feed}.glb` contains glTF 2.0 uncompressed triangle meshes, positions, normals and opaque material factors. No Draco, Meshopt, image texture or animation decoder is required. Each object is centered, approximately 3 units tall, Y-up and faces +Z. Blender authoring is Z-up/front -Y. The cap's visor and the brain's eyes extend toward +Z in the exported asset.

Each export carries `COLOR_0`: linear grayscale local cavity shading multiplied by the same constant ivory `baseColorFactor`. This reveals eye sockets, hair, cap seams and brain folds without baking directional lighting into the mesh. The attribute is baked on the separate export copy; no source texture maps are needed. The GLBs include source attribution in `asset.copyright`; every poster also links to its source and CC BY 4.0 license.

Fine marble grain comes from the native WebGPU shader. The transparent WebP images are compact fallbacks rendered from the same meshes, used while a GPU asset loads or when WebGPU is unavailable. Only GLB and WebP assets belong in `website/assets/journey`; working PNGs and source files must stay outside the embedded runtime asset directory.

Blender renders are insufficient to validate browser geometry: also inspect the final GLB in Chrome with the real WebGPU shader, including front and side views, before publishing.
