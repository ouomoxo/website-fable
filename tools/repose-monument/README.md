# KLEOS — monument pipeline

The hero of the site is a real museum-grade scan, not procedural geometry:
**"Lucy,"** a winged Victory from the
[Stanford 3D Scanning Repository](https://graphics.stanford.edu/data/3Dscanrep/),
stood upright, decimated for the web, and set on a computed classical
pedestal. The browser (`js/world.js`) only lights it and grades the frame.

The shipped asset is `assets/models/monument.glb` (hi) and `monument-lo.glb`
(mobile), each a meshopt-compressed GLB with two named meshes: `figure` and
`pedestal`.

## Rebuild

```sh
# 0. deps (Python 3.11)
pip install bpy==4.2.0
npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer

# 1. Blender can't read EXT_meshopt_compression — decompress the source scan
node decompress.mjs lucy.glb lucy_plain.glb

# 2. stand + pedestal + export (run twice: hi and lo)
python build_monument.py lucy_plain.glb 0.55 monument_raw.glb
python build_monument.py lucy_plain.glb 0.30 monument_raw_lo.glb

# 3. meshopt-compress into the repo
node compress.mjs monument_raw.glb    ../../assets/models/monument.glb
node compress.mjs monument_raw_lo.glb ../../assets/models/monument-lo.glb
```

## Notes

- The loader (`js/assets.js`) keeps mesh **geometry** only and discards node
  transforms, so `build_monument.py` bakes the figure's placement into her
  vertices before export. Both meshes share one coordinate space with the
  pedestal base on the ground at `y = 0`.
- The figure has no UVs; `js/world.js:veinFigure()` bakes marble variation
  into vertex colour (`COLOR_0`) at load and lights it with the `scan`
  material. The pedestal keeps its cube UVs and takes the `stone` material.
- Camera anchors in `js/camera.js` are tied to the figure's feature
  positions (head, torch, wings, gown, cornice). If you change the pose or
  pedestal height, re-probe those positions and re-fit the shots.
- `blender_lib.py` also renders Cycles stills (used to art-direct the pose
  offline); it is not needed at runtime.

Credit: "Lucy," Stanford Computer Graphics Laboratory, Stanford 3D Scanning
Repository.
