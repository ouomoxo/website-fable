# KATABASIS — The House of Forgotten Gods

A 3D interactive monument for the browser: a descent in six chambers through a
sunken sanctuary of veiled figures, fallen columns, and one winged colossus
that refused to be forgotten. Scroll is the dolly; the building refuses to be
rushed.

![KATABASIS](assets/poster.jpg)

## The descent

| | Chamber | |
|---|---|---|
| I | **Threshold** | a ruined gate under the last of the sky |
| II | **The Procession** | forty columns, rhythm of cold light |
| III | **The Veiled** | three shrouded gods — the Witness, the Orant, the Mourner |
| IV | **The Fallen** | a roof that failed in one night, kept exactly as it fell |
| V | **The Winged One** | a colossus whose wings unfurl as you approach |
| VI | **Anabasis** | the ascent, the oculus, the white |

## Run it

Everything is static — no build step, no bundler, no external requests.

```bash
# any static file server works
python3 -m http.server 8000
# then open http://localhost:8000
```

## How it is made

- **Three.js** (vendored in `js/lib/`), one `<canvas>`, one post-processing pass
  (ACES tone, split grade, grain, vignette, entrance black, finale white).
- **Every asset is procedural.** Marble veining is computed on a canvas;
  columns are lathed with entasis and twenty flutes; the veiled figures are
  radial drape fields (silhouette profile + fold harmonics); the wings are
  parametric carved surfaces with scalloped trailing edges, deformed each
  frame as they unfurl. No model files, no downloaded textures.
- **Scroll → camera spline.** A single damped shot along a Catmull-Rom path
  with keyframed look-targets and focal lengths; pointer parallax lets you
  look around without leaving the path.
- **Light as narrative.** Each chamber has its own rig; a carried lantern
  travels with you; the veiled figures' votive lights swell toward your
  attention (pointer on desktop, proximity on touch).
- **Sound is optional and synthesized** — a drone the depth of the building,
  breathing air, distant stone settling. Silence is the default; the choice is
  offered at the door.
- **Typography:** Cormorant Garamond & Inter, self-hosted (OFL).

## Access & performance

- `prefers-reduced-motion` honored; a manual **STILL** toggle does the same.
- All copy is real DOM text — screen-reader reachable, selectable, indexable.
- Keyboard: arrows / PageUp / PageDown / Home / End; navigation is focusable.
- Quality scales by device (pixel ratio caps, shadow toggles, particle counts)
  and degrades adaptively if the frame rate drops.
- No WebGL? A quiet fallback page keeps the door marked.

MMXXVI. No stone was quarried.
