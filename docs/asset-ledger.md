# Asset ledger — AFTER EMELYN

| Asset | Origin | License | Bytes (approx) | Notes |
|---|---|---|---|---|
| `assets/models/hand.glb` | xeogl example hand (OBJ) → own converter (`Loop subdivide ×1, weld, meshopt`) | MIT | 534 KB | 53.9k tris; hi tier |
| `assets/models/hand-lo.glb` | same, simplified | MIT | 142 KB | 13.5k tris; touch tier |
| `assets/fonts/*.woff2` | Cormorant Garamond, Inter | SIL OFL 1.1 | ~90 KB | subset woff2 |
| `js/lib/three.module.min.js` | three.js r160 | MIT | 666 KB | pinned, vendored |
| `js/lib/GLTFLoader.js`, `BufferGeometryUtils.js`, `meshopt_decoder.module.js` | three.js r160 examples | MIT | — | vendored |
| `assets/poster.jpg` | rendered from this project's live scene | project | 320 KB | og:image |
| `assets/mark.svg` | drawn for this project | project | <1 KB | favicon |

Everything else is generated at load time by project code: the body
drape, both wings, the hair coil, pedestal, rough base (js/monument.js)
and all textures — marble, limestone, quarry stone, bump/grain fields
(js/materials.js, canvas-computed). No downloaded textures, no scans of
the historical sculpture.
