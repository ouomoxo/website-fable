# KLEOS — baked-GI pipeline

How the site gets **photoreal quality, free orbit, and no lag at once**:
real-time WebGL can't path-trace, so the Cycles lighting (global illumination,
soft shadows, ambient occlusion) is **baked into textures** offline. Diffuse
GI is view-independent, so once it's on the surface the browser can render the
geometry from *any* angle — the visitor orbits freely at photoreal quality
with no per-frame cost (~2 draw calls, no runtime lights, no shadow maps).

Two light states are baked — a cold **dark** and a warm **glory** — and
`js/world.js` blends between them by scroll (the emotional arc: darkness →
the flame ignites → glory).

## Pipeline

```sh
pip install bpy==4.2.0
npm i @gltf-transform/core @gltf-transform/extensions @gltf-transform/functions meshoptimizer sharp

# 0. decompress the Stanford "Lucy" scan for Blender
node ../repose-monument/decompress.mjs ../../assets/models/lucy.glb lucy_plain.glb
export LUCY_PLAIN_GLB=$PWD/lucy_plain.glb

# 1. build scene, UV-unwrap figure + joined architecture, bake COMBINED GI
#    for both light states, export geometry (UVs, no materials)
python bake_full.py            # → /tmp/lm/{figure,arch}_{glory,dark}.png + baked.glb

# 2. meshopt-compress the geometry (no weld — keep UV-split verts)
node compress_baked.mjs /tmp/lm/baked.glb ../../assets/baked/baked.glb

# 3. encode the four lightmaps to WebP (arch downscaled to 2048)
#    (sharp one-liner — see the encode step in the session, quality 84–88)
```

## Notes

- `assemble_scene.py` builds the temple + light rig; `bake_full.py` joins the
  architecture, unwraps (Smart UV Project), and bakes each object for the
  `glory` and `dark` states, then exports `baked.glb`. `setlib.py` holds the
  column/drum/capital/altar builders; `blender_lib.py` the scan helpers.
- **Materials & finish** (`marble_proc` in `assemble_scene.py`): the
  architecture uses procedural marble — wandering vein bands, a broad
  warm/cool tone drift, and a faint micro-relief bump — so it never bakes as
  flat cardboard. Keep it restrained (high roughness, tiny bump) or it reads
  as wet plastic. The hero is the detailed scan: it stays **flat** marble
  (`marble`), because procedural veining only mottles it. Every box course is
  edge-beveled (`bevel_mesh`) so it catches the key instead of showing a
  razor CG crease. A warm rim light from high-behind separates the hero from
  the dark; `bake_full.light_state` toggles it (and all lights) per state.
- `BAKE_FAST=1` shrinks maps/samples for quick iteration; unset for the
  full 2048 (figure) / 4096 (architecture) ship bake — allow ~15 min on CPU.
- **Re-bake as a whole**: Smart UV Project lays out UVs fresh each run, so the
  textures only match the GLB exported in the *same* run. Never re-bake one
  object against an old GLB.
- The figure has its own lightmap UV + textures; all architecture shares one.
  The floor is drawn plain at runtime (a huge plane would starve the atlas).
- Runtime blend/tone is in `js/world.js` (BLEND shader) and `js/effects.js`
  (ACES + bloom). Baked PNGs hold sRGB-encoded scene-linear values; the shader
  decodes to linear, blends, fogs; the post pass tonemaps.

Credit: "Lucy," Stanford Computer Graphics Laboratory, Stanford 3D Scanning
Repository.
