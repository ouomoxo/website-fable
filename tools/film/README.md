# KLEOS — the pre-rendered film

The site's visual backbone is **not** real-time WebGL. Real-time rasterisation
can't match an offline path tracer, so the whole thing is rendered in **Blender
Cycles** — path-traced global illumination, subsurface marble, soft area
shadows, atmospheric depth — as a frame sequence, and the browser
(`js/film.js`) plays it back scroll-driven, like a projector.

## Pipeline

```sh
pip install bpy==4.2.0
npm i @gltf-transform/core @gltf-transform/extensions meshoptimizer sharp

# 0. the figure: decompress the Stanford "Lucy" scan so Blender can read it
node ../repose-monument/decompress.mjs ../../assets/models/lucy.glb lucy_plain.glb
export LUCY_PLAIN_GLB=$PWD/lucy_plain.glb

# 1. render the continuous camera move as a PNG sequence (Cycles, denoised, AgX)
#    render_seq.py <N> <start> <end> [--novol]
#    --novol swaps the expensive world volume for a cheap mist-pass fog
python render_seq.py 72 0 72 --novol         # → /tmp/seq/f000.png … f071.png

# 2. encode to WebP: full + mobile (720w) sets
node encode.mjs /tmp/seq ../../assets/film    76        # → assets/film/*.webp
node encode.mjs /tmp/seq ../../assets/film-lo 70 720    # → assets/film-lo/*.webp
```

`assemble_scene.py` builds the whole temple (Lucy on a classical pedestal, an
instanced fluted-Doric colonnade with architraves, fallen drums and a toppled
capital, an altar with an emissive flame, a stone floor) and its lighting (a
warm spot-key shaft, a raking sun, a cool fill, mist-fog depth). Run it directly
for a single hero still; `render_seq.py` imports it and drives the camera path.

`setlib.py` holds the procedural column / drum / capital / altar builders;
`blender_lib.py` the scan-loading and render helpers.

## Notes

- One continuous move: intimate on the torch and wings → pull back and rise
  through the colonnade to the whole temple. Copy beats in `index.html` map to
  scroll fractions over that move.
- `--novol` keeps frame time to ~20 s (CPU); the full world volume is ~5–10×
  slower but gives true volumetric god-rays if you have the render budget.
- Change `FRAMES` in `js/main.js` if you render a different count.

Credit: "Lucy," Stanford Computer Graphics Laboratory, Stanford 3D Scanning
Repository.
