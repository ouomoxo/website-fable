# Performance budget — AFTER EMELYN

| Budget | Target | Actual (desktop hi tier) |
|---|---|---|
| JS payload (three.js + app, uncompressed) | < 1.0 MB | ≈ 0.80 MB |
| Models | < 700 KB | 534 KB (hand.glb) / 142 KB (lo) |
| Fonts | < 120 KB | ≈ 90 KB |
| Textures | 0 downloaded | 0 (all canvas-computed) |
| Triangles in scene | < 250k | ≈ 150k (hi), ≈ 90k (lo) |
| Draw calls | < 40 | ≈ 20 |
| Shadow maps | 1 × 2048 | 1 × 2048 (key only) |
| Post passes | 1 | 1 |
| Load-to-enter (mid laptop, warm cache) | < 4 s | ≈ 2–3 s (procedural carving dominates) |

Degradation ladder: touch tier (dpr ≤ 1.8, 384px textures, detail 0.7,
lo model) → runtime FPS probe drops pixel ratio once by ×0.72 if the
90-frame average exceeds 34 ms → STILL mode removes damping/sway cost.
