# ANAMNESIS — asset ledger

| Asset | Role | Source / license | Tris (hi/lo) | Size (hi/lo) | Framing limit |
|---|---|---|---|---|---|
| lucy.glb | fragment donor (sliced: lower, torso, wingL, wingR; head discarded) | Stanford 3D Scanning Repository, acknowledgment terms | 100k / 45k | 1.03 MB / 0.47 MB | medium; camera never nearer than ~9 m equivalent |
| igea.glb | the face (hall), the relic (colonnade), the head (movement II) | Cyberware sample scan, research-redistributed | 269k / 81k | 2.62 MB / 0.83 MB | close-medium |
| columns, piers, walls, stairs, plinths, rods | architecture | original, procedural | n/a | code | any |
| carved wing | movement II fragment | original, parametric | 8k | code | medium |
| marble/limestone/pigment textures | materials | original, canvas-computed | — | runtime | any |
| audio | opt-in ambience | original, synthesized | — | runtime | — |

Modifications to scans: decimation (upstream mirror), meshopt-compressed GLB
(own pipeline: weld, smooth normals, optional simplify), runtime slicing,
per-vertex tonal tint and pigment mask. See ATTRIBUTION.md.
