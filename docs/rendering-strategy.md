# Rendering strategy — AFTER EMELYN

## One scene, one pass

A single `<canvas>`, one THREE.Scene, one PerspectiveCamera driven by a
shot list, and exactly one post-processing pass (fullscreen triangle):
ACES tone map → warm/cool split grade → barely-there grain → quiet
vignette → entrance black. Rendering is linear; the pass outputs sRGB.

## The stone

- **Figure stone** (drape, wings, hair): MeshStandardMaterial with
  vertex-color AO baked during carving (fold cavities, feather seams,
  strand grooves) plus a fine crystalline bump map so close shots read
  as marble, not soap. DoubleSide — the drape and vanes are open shells.
- **Pedestal marble**: computed veined marble + fine bump.
- **Walls/ground**: computed dark limestone, coarse bump, high roughness.
- **Environment**: a tiny PMREM-baked room (dim overhead opening + faint
  warm side) so speculars have something honest to reflect; intensity
  kept ≤ 0.2 everywhere to avoid the "wet plastic" look.

## The light

One key (soft daylight, front-left), hemisphere fill, a directional
warm bounce (no light pools), a desaturated rim. Shadows: one 2048 PCF
soft map on the key only; normalBias 0.05 to survive the drape creases.
Movement V lowers/cools/dims the key, drops the fills, thickens fog —
the "day turning late." Nothing else is animated.

## Geometry

Everything carved at load: lofted bezier-section body drape (clamped
against the slab so cloth lands on stone), two fan-vane wings with
radiating feather relief and world-space rest clamps, a torus-coil hair
knot, tapered pedestal, chisel-faceted base. Hi tier ≈ 150k triangles
total; touch tier scales segment counts by 0.7 and swaps the 54k-tri
hand for a 13.5k version.

## Performance ladder

dpr clamp (≤2 desktop, ≤1.8 touch) → texture size (512/384) → geometry
detail (1.0/0.7) → asset tier (hi/lo). At runtime a 90-frame FPS probe
drops pixel ratio ×0.72 once if the average frame exceeds 34 ms. The
STILL toggle (or prefers-reduced-motion) freezes sway and damping.
