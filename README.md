# ANAMNESIS

**A monument that exists only from one point of view.**

A fragmented Greek monument that becomes complete only from the viewer's
exact perspective. Separated stone fragments — a face, a torso, two wings,
a fall of drapery — stand on their own armatures at different depths in a
dark hall. From one privileged position they agree into a single winged
figure, and traces of lost polychromy briefly return. Move, and it becomes
history again.

![ANAMNESIS](assets/poster.jpg)

## The five movements

| | Movement | |
|---|---|---|
| I | **The False Memory** | a silent colonnade; the accepted white image of antiquity |
| II | **The Separation** | a goddess's head found by a waking window; a wing without its figure |
| III | **The Measure** | the hall of fragments, entered off-axis; perspective is the system |
| IV | **The Agreement** | at one exact point the fragments form the body; pigment surfaces |
| V | **The Afterimage** | a few steps are enough; the image separates; memory reconstructs |

The complete figure is never present as one model. `js/assets.js` slices
the scanned figure into fragments; `js/world.js` scales each fragment about
the privileged camera position (`CSTAR`) so its projection is preserved
while it stands somewhere else entirely. The reveal and its loss are pure
perspective — no crossfades, no swapped statue.

## Run it

Everything is static — no build step, no bundler, no external requests.

```bash
python3 -m http.server 8000     # any static server; ES modules need http://
```

`?probe` exposes `window.__KB` (deterministic frame control) for testing.

## How it is made

- **Three.js r160** (vendored), one canvas, one post pass (ACES, gentle
  split grade, near-invisible grain).
- **Real scans, never whole.** *Lucy* (Stanford) donates the body fragments;
  *Igea* (Cyberware) is the face. Meshopt-compressed GLBs, 1.3–3.7 MB total
  by device tier, sliced and pigment-masked at load.
- **Lost color.** Pigment (Egyptian blue, red ochre, carbon black, mineral
  green, worn gilding) is baked per-vertex into recesses and borders and
  revealed by an alignment-driven uniform — evidence, not paint.
- **Authored camera.** A scroll-driven shot list with holds; an alignment
  basin damps pointer deviation to zero as the eye reaches the privileged
  point, so every visitor succeeds without precision effort.
- **Sound** is optional and synthesized; the drone resolves as the
  fragments agree. Silence is complete.

## Access & performance

- Reduced-motion honored; STILL and SOUND toggles; keyboard navigation;
  semantic DOM copy; designed no-WebGL fallback.
- Touch devices receive lighter meshes and textures; render scale adapts
  if the frame rate drops; chambers are visibility-culled by scroll range.
- Docs: `docs/creative-brief.md`, `docs/shot-bible.md`,
  `docs/asset-ledger.md`, `docs/performance-budget.md`, `docs/qa-report.md`.
- Licenses: `ATTRIBUTION.md`.

Memory does not preserve. It reconstructs. MMXXVI.
