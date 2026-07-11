# Asset ledger — AFTER EMELYN

The hero monument is produced by an offline two-step pipeline and
shipped as meshopt-compressed GLB; the browser only lights it.

| Asset | Origin | License | Bytes | Notes |
|---|---|---|---|---|
| `assets/models/monument.glb` | offline sculpt+assemble (see below) | project | ~4.2 MB | ~440k tris; volumetric figure + wings + tall pedestal, AO baked into COLOR_0 |
| `assets/models/monument-lo.glb` | same, decimated | project | ~1.7 MB | mobile/low tier |
| `assets/models/hand.glb` / `-lo.glb` | xeogl example hand (OBJ) → own converter | MIT | 534 / 142 KB | the one bare element — hangs down the front face |
| `assets/fonts/*.woff2` | Cormorant Garamond, Inter | SIL OFL 1.1 | ~90 KB | subset woff2 |
| `js/lib/three.module.min.js` + examples | three.js r160 | MIT | ~0.7 MB | vendored |
| `assets/poster.jpg` | rendered from the live scene | project | ~0.3 MB | og:image |
| `assets/mark.svg` | drawn for this project | project | <1 KB | favicon |

## Hero monument production pipeline (offline)

The figure is **not** a displaced sheet. It is a watertight VOLUME:

1. **`tools/sculpt-figure.mjs`** — defines the clothed, collapsed figure
   as a signed-distance field (SDF) built from an anatomical skeleton of
   primitives (back, shoulders, neck, buried head + hair mass, folded
   cradling arm, hanging arm, torso/hips behind) plus cloth falls (bent
   sheets with wavy hems) and a three-level fold field. It is meshed with
   a hand-written **Surface Nets** isosurface extractor at ~1 cm voxels
   (36M-cell grid → ~360k verts), with **SDF-based ambient occlusion**
   and mineral tint baked into vertex colours. Writes `tools/.figure-hi.json`.
2. **`tools/bake-monument.mjs`** — the assembler. Loads the figure volume,
   builds the **tall molded pedestal** (lofted molding profile), the
   **rough base**, and the **wings** (a carved vane with radiating feather
   relief plus separated feather-tip strips) oriented to rise to a peak
   and cascade down the left, bakes proxy/contact AO on the architecture,
   merges, meshopt-compresses, and writes `monument.glb` / `-lo.glb`.

`tools/.figure-*.json|glb` are build intermediates (git-ignored); rebuild
with `node sculpt-figure.mjs <repo> hi && node bake-monument.mjs <repo>`
from a directory providing `@gltf-transform/*` and `meshoptimizer`.

The scanned **hand** is loaded separately at runtime and positioned at the
forearm's wrist. All stone textures are canvas-computed at load. No
photographs, no scans of the historical sculpture, no downloaded textures.
