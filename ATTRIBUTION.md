# Attribution

**AFTER EMELYN** — an original interactive digital memorial inspired by
William Wetmore Story's *Angel of Grief* (Non-Catholic Cemetery, Rome,
1894). This project's monument is an original procedural work referencing
the posture and emotional logic of the historical sculpture; it is not a
scan or reconstruction of it. See `docs/research.md` and
`docs/source-ledger.md` for the factual record and claim-by-claim
sourcing.

## Code

- [three.js](https://threejs.org) r160 — MIT. Vendored: core module,
  GLTFLoader, BufferGeometryUtils, meshopt decoder.
- All scene, carving, material, camera and audio code — this project.

## Assets

- Hand mesh: from the xeogl example model set — MIT. Converted OBJ→GLB
  with this project's own pipeline (Loop subdivision, weld, meshopt).
- Fonts: Cormorant Garamond & Inter — SIL Open Font License 1.1.
- All textures computed at runtime (canvas fbm noise). No photographs,
  no downloaded textures.
- Poster image rendered from this project's own scene.

## Sound

Optional, opt-in ambience is synthesized in WebAudio at runtime; no
recordings are used.
