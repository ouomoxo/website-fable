# Attribution

## Sculpture scans

- **Lucy** — Stanford Computer Graphics Laboratory, the Stanford 3D Scanning
  Repository (https://graphics.stanford.edu/data/3Dscanrep/). Used with
  acknowledgment per the repository's terms. The mesh is decimated
  (via the mirrors in `alecjacobson/common-3d-test-models`), converted to
  meshopt-compressed GLB, and sliced at runtime into separate anatomical
  fragments — the complete figure is never shown as one object.
- **Igea** — Cyberware sample head scan, long redistributed for graphics
  research; obtained via `alecjacobson/common-3d-test-models`.

## Everything else

- Architecture (columns, piers, walls, stairs, plinths), stone and pigment
  materials, the carved wing, light shafts, dust, and sound are computed —
  no downloaded textures, photographs, or audio recordings.
- Typefaces: Cormorant Garamond and Inter, self-hosted under the SIL Open
  Font License.
- Built on three.js (MIT), with GLTFLoader and the meshopt decoder from the
  three.js examples (MIT), vendored at r160.
