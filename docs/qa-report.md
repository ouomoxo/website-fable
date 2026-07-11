# QA report — AFTER EMELYN

Environment: headless Chromium (Playwright), python http.server. Visual
review: one frame per beat, desktop 1440×810 and portrait 390×844.

## Functional
| Check | Result |
|---|---|
| Load → loader → Enter | PASS (no console errors) |
| Forward scroll sweep 0→1 | PASS, reaches 1.0 |
| Reverse sweep 1→0 | PASS |
| Keyboard End / Home | PASS |
| Nav movement links | PASS |
| Sound toggle on/off (opt-in) | PASS |
| STILL toggle | PASS |
| prefers-reduced-motion | PASS (auto STILL) |
| WebGL blocked | PASS (text fallback, loader removed) |
| Console errors | NONE |

## Visual (frames inspected at full size)
| Beat | Verdict |
|---|---|
| S01 wing feathers as architecture | PASS — feather rows read as fluting |
| S02 colonnade → feathers | PASS |
| S03 drapery down the left | PASS |
| S04 hanging hand + fingers | PASS — hand tucks into the sleeve, fingers hang |
| S05 hidden/bowed head on the arm | PASS — face never shown |
| S06 pedestal molding vs raw base | PASS |
| S07 withdrawal | PASS — full monument resolves, low angle |
| S08 full monument hero | PASS — reads as the collapsed mourning angel |
| Mobile portrait hero | PASS — whole monument framed high, copy owns the ground |
| Fallback page | PASS |

## Composition
Recomposed to the reference: a **tall pedestal**, the figure collapsed
forward over its top, the **head with hair bowed onto the folded arm**,
**one arm and hand hanging down the front face**, drapery down the left,
and a **single great wing rising to a peak** then cascading down the left,
seen **low, looking up**.

## Honest limitations (not certified award-ready)
This environment has no ZBrush/Blender, no legally-usable high-fidelity
scan, and no network access for AI-mesh generation (all blocked). The hero
is therefore an **original procedural VOLUMETRIC digital sculpture** (SDF +
Surface Nets) — a real step up from the prior sheet asset in true volume,
all-angle correctness, wing mass, and grounded contact — but it is not a
hand-sculpted master asset. Residual weaknesses, honestly logged:
- head/hair is a smooth sculptural mass, not individually carved locks;
- the wing's underside shows mild feather-row banding at close range;
- drapery has primary/secondary structure but not master-level tertiary
  crispness;
- the scanned hand and the SDF forearm differ slightly in surface idiom at
  the wrist join (mitigated by tucking the hand into the sleeve).
These are asset-fidelity limits of the available toolchain, documented per
the production directive rather than hidden with darkness or post.
