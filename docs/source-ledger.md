# Source ledger — AFTER EMELYN

Every claim surfaced to the visitor, and every external asset, with its
source and status. Companion to `docs/research.md`.

## Claims made in the experience (epilogue, movement V)

| # | Claim (as shown on site) | Basis | Status |
|---|---|---|---|
| 1 | "In Rome's Non-Catholic Cemetery…" | Standard record of the Story grave's location (Cimitero Acattolico, Rome) | Stated; year-level facts only |
| 2 | "…the American sculptor William Wetmore Story carved his last work as a memorial to his wife, Emelyn." | Standard art-historical record; the Angel of Grief is regarded as Story's final major work (1894) | Stated |
| 3 | "He called it the Angel of Grief." | The sculptor's own title, in shortened common form; full title recorded in research.md | Stated |
| 4 | "He did not long outlive it, and is buried beside her, beneath it." | Story died 1895; joint grave beneath the monument | Stated |
| 5 | "This memorial is an original digital monument inspired by that work — not a scan of it." | Statement about this project itself | Stated (disclosure) |

Primary online sources (Wikipedia article "Angel of Grief"; the
Non-Catholic Cemetery of Rome's official pages; Smithsonian/SAAM
records) could **not** be fetched from the build environment (outbound
requests to those hosts are blocked by the environment proxy). The
claims above were therefore restricted to durable, widely documented
facts at year precision, and no day-level dates, quotations, or
inscription texts are asserted anywhere in the experience.

## External assets

| Asset | Source | License | Use |
|---|---|---|---|
| `assets/models/hand.glb` / `hand-lo.glb` | Hand mesh from the xeogl example model set, converted from OBJ, Loop-subdivided and meshopt-compressed offline | MIT | The one bare hand of the figure; resculpted scale/pose context |
| `assets/fonts/CormorantGaramond-italic-300.woff2` | Cormorant Garamond (Google Fonts) | SIL OFL 1.1 | Display serif |
| `assets/fonts/Inter-normal-300.woff2` | Inter (Google Fonts) | SIL OFL 1.1 | UI sans |
| three.js r160 (`js/lib/`) | three.js project | MIT | Renderer, GLTFLoader, BufferGeometryUtils, meshopt decoder |

Everything else — the drapery, wings, hair, pedestal, base, all textures
(marble, limestone, bump fields) — is **computed at load time** by this
project's own code (`js/monument.js`, `js/materials.js`). No photographs,
no scans of the historical sculpture, no downloaded textures.

## Reference imagery

A present-day photograph of the original monument was consulted during
development (supplied by the project owner) purely as a *posture and
massing reference* for an original composition. It is not distributed
with the repository and no pixels from it appear in the project.
