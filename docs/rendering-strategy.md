# Rendering strategy — AFTER EMELYN

## Offline volume, online light

The mourning figure is a genuine watertight **volume**, not a sheet. It is
sculpted offline as a signed-distance field and meshed with Surface Nets
(`tools/sculpt-figure.mjs`), so it is correct from every angle — essential
for the low, upward-looking camera and the withdrawal. Ambient occlusion
is computed directly from the SDF (marched along the surface normal) and
baked into vertex colours, giving real cavity shading with no runtime cost.
The wings are explicit carved vanes with radiating feather relief and
separated feather-tip strips; the pedestal is a lofted molding profile.
Everything is assembled and meshopt-compressed offline into `monument.glb`.

## One scene, one pass

A single `<canvas>`, one THREE.Scene, one PerspectiveCamera driven by a
low-angle shot list, and exactly one post pass (fullscreen triangle):
ACES tone map → warm/cool split grade → barely-there grain → quiet
vignette → entrance black. Rendering is linear; the pass outputs sRGB.

## The stone

- **Figure / wings** (`scan`, `feather`): MeshStandardMaterial with the
  baked SDF/relief AO in COLOR_0 plus a fine crystalline bump so close
  shots read as marble. DoubleSide for the open feather vanes.
- **Pedestal / base**: computed veined marble and pale quarry limestone.
- **Environment**: a tiny PMREM-baked room (dim overhead opening + faint
  warm side) so speculars have something honest to reflect; intensity ≤ 0.2.

## The light

One key (soft daylight, front-left), hemisphere fill, a directional warm
bounce (no light pools), a desaturated rim, plus a static soft
contact-shadow decal grounding the base. Shadows: one 4096 (2048 on touch)
PCF soft map on the key. Movement V lowers/cools/dims the key, drops the
fills, thickens fog — the day turning late. Nothing else is animated.

## Camera

Mounted. No pointer sway, no handheld noise — the dolly is exact. Shots are
low, looking up at the tall pedestal, after the reference.

## Performance ladder

dpr clamp (≤2 desktop, ≤1.8 touch) → texture size (512/384) → shadow map
(4096/2048) → asset tier (hi ~440k tris / lo ~decimated + lo hand). A
90-frame FPS probe drops pixel ratio ×0.72 once if the average frame
exceeds 34 ms. STILL / prefers-reduced-motion freezes damping.
