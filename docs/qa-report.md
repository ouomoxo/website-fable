# QA report — AFTER EMELYN

Date: 2026-07-11 · Environment: headless Chromium (Playwright),
python http.server. Visual review: one frame per shot, desktop
1440×810 and portrait 390×844.

## Functional

| Check | Result |
|---|---|
| Load → loader → Enter | PASS (no console errors) |
| Full forward scroll sweep (0→1) | PASS, reaches 1.0, no errors |
| Reverse sweep (1→0) | PASS |
| Keyboard End / Home | PASS (p→1, p→0) |
| Nav movement links (e.g. III) | PASS (lands mid-range 0.696 for 0.66–0.74) |
| Sound toggle on/off | PASS (aria-pressed true/false; opt-in only) |
| STILL toggle | PASS |
| prefers-reduced-motion | PASS (STILL auto-enabled) |
| WebGL blocked | PASS (text fallback shown, loader removed) |
| Console errors across all checks | NONE |

## Visual (frames inspected at full size)

| Beat | Verdict |
|---|---|
| S01 fluted wall | PASS — reads as carved relief in raking light |
| S02 colonnade → feathers | PASS — ribs converge on scalloped tips |
| S03 ravine of falls | PASS — metric folds, clean lip silhouette |
| S04 hanging hand | PASS — limp hand below hem, wrist lost in cloth |
| S05 hidden face | PASS — hair coil only; no face at any angle |
| S06 carved vs sawn | PASS |
| S07 withdrawal mid | PASS — full figure resolves; angel legible |
| S08/S10 monument + distance | PASS — late-light state reads |
| Mobile hero / withdrawal | PASS (portrait offsets keep monument high) |
| Fallback page | PASS |

## Known limits (accepted this pass)

- The hair coil reads slightly pastry-like in extreme close-up.
- Wing relief shows mild quilting on its shaded back face.
- The figure is deliberately stylized — an original monument, not a
  reconstruction (see docs/research.md).
