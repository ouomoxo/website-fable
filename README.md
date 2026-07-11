# AFTER EMELYN

*He could not preserve a life. He gave the loss a form.*

An interactive digital memorial inspired by William Wetmore Story's
**Angel of Grief** (Rome, 1894). What begins as monumental stone
architecture — a fluted wall, a colonnade, a ravine — is revealed, in a
single slow withdrawal, to have been extreme close views of one
unmoving angel collapsed over an altar.

The angel never moves. The camera moves; the light moves; the copy
moves. Nothing else.

## Run

Any static server from the repository root:

```
python3 -m http.server 8000
# open http://localhost:8000
```

No build step. three.js r160 is vendored under `js/lib/`.

## Structure

See `docs/architecture.md`. Creative intent: `docs/creative-brief.md`.
Camera language: `docs/shot-bible.md`. Facts vs poetry:
`docs/research.md`, `docs/source-ledger.md`. Licenses: `ATTRIBUTION.md`.

## Accessibility & fallbacks

- Reduced-motion honoured (and a manual STILL toggle).
- Keyboard: scroll, Home/End, focusable controls.
- Sound strictly opt-in.
- A text fallback renders where WebGL is unavailable.
- Device tiers: DPR clamp, texture size, geometry detail, lo-poly model
  on touch; runtime FPS degradation.
