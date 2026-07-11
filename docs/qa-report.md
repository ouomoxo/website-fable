# ANAMNESIS — QA report

Performed (headless Chromium 1440×810 and 390×844 touch emulation, one
compressed frame per check, zero console/page errors in every run):

- Hero (desktop + portrait), wordmark agreement animation end state
- Colonnade perception slide and pier occlusion pass (0.16 / 0.25)
- Stair blade (0.35); face light-turn dark→lit (0.45 / 0.52 / 0.62)
- Wing raking shot (0.82); doorway preview (0.72)
- Measure off-axis scatter (0.885): fragments read as separate, supported
- Agreement (0.95 desktop + portrait): figure complete, pigment visible
- Departure (0.982): body separates by perspective; ending (1.0) with slot
- Repeated replay via probe jumps; reverse scroll implicitly via probe
- Loader path (assets download → build → enter) exercised on every capture

Known limitations (honest):
- Lucy's decimation softens under close framing; the shot list respects it.
- Suspension rods are visible above fragments from oblique views by design;
  from CSTAR they read as thin dark verticals in the unlit height.
- Safari/WebKit and Firefox not directly testable in this environment;
  code avoids APIs outside their common support (ES modules, WebGL2 with
  UnsignedByte fallback path in the post pass).
- github.io unreachable from the build environment, so Pages serving was
  not end-to-end verified here.
