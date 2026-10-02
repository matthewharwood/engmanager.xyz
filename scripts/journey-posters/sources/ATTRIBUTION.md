# Sculpture sources and attribution

## Aristotle portrait: coaching, shop and subscribe

The coach, shop and subscribe sculptures are adapted from **[“Aristotele bust”](https://sketchfab.com/3d-models/aristotele-bust-8717fddd94c44498a5f91d652f866930)** by **[nicola_scaramella](https://sketchfab.com/nicola_scaramella)**, licensed under **[Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/)**. The creator describes it as a bust of the philosopher Aristotle from a private collection. Attribution does not imply the creator endorses this site or the adaptations.

The original STL was downloaded on 2026-10-01 using Sketchfab's normal authenticated “Download 3D Model” action. The model page, download dialog, and public metadata identify the license as CC Attribution; the public metadata explicitly permits commercial use with author credit. `aristotele-sketchfab.json` records that public metadata. No viewer geometry was extracted.

`aristotele-bust.zip` is the unchanged original download. Its SHA-256 is:

```text
c06b75a36fe3d7c378bf426d95d11f50a0639261453cc522e22def17538e0565
```

The outer archive contains `source/bec055ddf65e4997b6b4fc4ed5a45275.zip.zip`; that inner archive contains `Aristotele (repaired).stl`. The build reads only those two known members. The STL has 110,854 vertices and 221,704 triangles, one connected surface, and no boundary or nonmanifold edges.

Our modifications are orientation and centering, normalization to a three-unit height, restrained enhancement of the scan's existing relief, decimation of an export copy to 180,000 triangles, a quiet ivory marble material, and local ambient occlusion baked into grayscale vertex colors. No new facial features or curls are synthesized. The complete original scan is retained in the hidden `Aristotle — preserved scan` collection in `coach.blend`, separately from the display copy. The source ZIP remains unchanged.

Shop adds an original modeled dad cap to a copy of the accepted coaching sculpture. The hidden upper scalp is compressed to fit beneath the crown; the visible lower face, beard and bust vertices are preserved. New geometry includes the crown, curved visor, panel seams, stitches, ventilation eyelets, covered button, rear opening and adjustable strap. Cavity shading is rebaked for the assembled sculpture. The accepted coaching Blender file and runtime exports are not rewritten by the shop pipeline.

Subscribe uses only a cropped facial surface of the accepted portrait, sampled directly from the scan into a small closed theatrical mask. This sampling preserves the source's natural forehead, eyes, nose, mouth and chin relief; no procedural facial features are invented. The skull, neck, shoulders and chest are absent from the visible sculpture. Two original thick stone scrolls supply its distinct body and silhouette: a broad asymmetrical sheet with continuous spiral volutes at both ends and shallow scored inscription strokes, and a second sweeping ribbon. A flared original stone border blends the face's perimeter into the main sheet, and the whole rear relief extends slightly into the scroll to support the cheeks and chin. All three pieces are independently closed surfaces with positive volume, then joined and normalized as one export object.

The accepted portrait is retained intact in the hidden `Oracle — accepted portrait reference` collection alongside the full original scan. Cavity shading is rebaked for the new assembly. `rebuild_subscribe.py` does not rewrite the accepted coach, shop or feed sources or runtime assets; `subscribe-validation.json` records the unchanged coach source hash, actual modifications and topology. The visible newsletter sculpture has resampled facial geometry; it does not claim to preserve the accepted portrait's vertex count or full body.

Each adaptation's attribution is preserved in the GLB's `asset.copyright`, the Blender object's `attribution` property, and the Blender `SOURCE AND LICENSE` text block. The website presents a source credit beside each portrait. The rendered fallbacks are images of the same licensed adaptations and require the same credit.

## Brain: Human Reference Atlas

The feed sculpture is adapted from **“3D Reference Organ for Brain, Male v1.3” by Kristen Browne and Heidi Schlehlein (2023)**, published by HuBMAP under **[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)**. Citation and persistent source: **[doi:10.48539/HBM929.XKCL.339](https://doi.org/10.48539/HBM929.XKCL.339)**. The [NIH 3D entry](https://3d.nih.gov/entries/20960) describes the Allen Human Reference Atlas data and confirms the v1.3 license.

The original public GLB was downloaded on 2026-10-01 from the [Human Reference Atlas publisher](https://lod.humanatlas.io/ref-organ/brain-male/v1.3/assets/3d-vh-m-allen-brain.glb). `hra-brain-male-v1.3.glb` retains that file unchanged. `hra-brain-male-v1.3.metadata.yaml` retains the publisher's [versioned metadata](https://github.com/hubmapconsortium/hra-kg/blob/main/digital-objects/ref-organ/brain-male/v1.3/raw/metadata.yaml), including creators, citation, license and underlying scientific sources. The GLB SHA-256 is:

```text
2b9ad5b53e40e9f0936da74f7be38d2eed15604e26358c3870a0ea13499b9a35
```

Our adaptation selects solid anatomical structures rather than empty-space labels such as ventricles, consolidates the surface while retaining the central fissure and natural folds, smooths segmentation artifacts, and adds original shallow carved eyes and a short cropped support. A separate export copy is simplified, centered and normalized, with the same warm ivory material and local cavity vertex colors as the portraits. The source meshes are preserved in a hidden collection in `feed.blend`.

The source creators and CC BY 4.0 license are credited in the GLB, editable Blender source and visible feed poster. Modifications are disclosed; neither the creators nor NIH/HuBMAP endorse this artistic adaptation. This stylized sculpture is not presented as a medical model.

Reference screenshots used during visual comparison are local study material, are not packed into the Blender file, and are not redistributed here.
