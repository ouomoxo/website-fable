# KATABASIS — The House of Forgotten Gods

A digital monument in five rooms: a descent past a goddess's head, one
recovered wing, and a winged colossus beneath an oculus. Scroll is the
dolly; the building refuses to be rushed. Room III turns on a single
perceptual shift: the chamber is first read as darkness and a rim of
light, until the window wakes and the mass becomes a face.

![KATABASIS](assets/poster.jpg)

## The descent

| | Room | |
|---|---|---|
| I | **Threshold** | a fallen colossal head outside a wall with one lit slit |
| II | **The Stair** | a slot of darkness, one blade of light |
| III | **The Face** | the same face again, found by a waking window |
| IV | **The Wing** | a marble wing recovered without its figure |
| V | **The Winged One** | a winged colossus where the light comes down |
| VI | **Anabasis** | the way up |

## Run it

Everything is static — no build step, no bundler, no external requests.

```bash
# any static file server works (ES modules need http://, not file://)
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it is made

- **Three.js** (vendored in `js/lib/`), one `<canvas>`, one post pass
  (ACES tone, gentle split grade, near-invisible grain, quiet vignette).
- **The sculptures are real scans.** The winged colossus is *Lucy*
  (Stanford 3D Scanning Repository); the head is the *Igea* scan
  (Cyberware sample). Both are served as meshopt-compressed GLBs
  (0.5–2.6 MB), normalized and vertex-tinted at load; a lighter tier
  ships to touch devices. The architectural stone and the wing fragment
  remain procedural — marble and limestone computed on a canvas, the
  wing a parametric carved surface.
- **The camera is a shot list, not a tour.** Each room gets one slow,
  composed movement, then stillness; between shots the frame holds.
  Pointer parallax lets you look without leaving the path.
- **Light is the composition.** One motivated key per room — a doorway, a
  window, a slit, an oculus — with sparse dust that exists only where it
  crosses the light.
- **Sound is optional and synthesized** — a drone the depth of the building,
  breathing air, distant stone settling. Silence is the default.
- **Typography:** Cormorant Garamond & Inter, self-hosted (OFL).

## Access & performance

- `prefers-reduced-motion` honored; a manual **STILL** toggle does the same.
- All copy is real DOM text — screen-reader reachable, selectable, indexable.
- Keyboard: arrows / PageUp / PageDown / Home / End; navigation is focusable.
- Quality scales by device (pixel-ratio caps, geometry detail, dust counts)
  and degrades adaptively if the frame rate drops.
- Portrait screens are reframed — subjects sit high, copy owns the floor.
- No WebGL? A quiet fallback page keeps the door marked.
- `?probe` exposes `window.__KB` for deterministic visual testing.

## Attribution

- *Lucy* — courtesy of the [Stanford 3D Scanning Repository](https://graphics.stanford.edu/data/3Dscanrep/).
- *Igea* — Cyberware sample scan, long redistributed for graphics research.
- Decimated meshes via [common-3d-test-models](https://github.com/alecjacobson/common-3d-test-models).

MMXXVI. No stone was quarried.
