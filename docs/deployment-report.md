# Deployment report — AFTER EMELYN

## Pipeline & sources
- **Repository:** ouomoxo/website-fable
- **Development branch:** `claude/3d-monument-visual-overhaul-nblrfz`
- **Deployment source:** GitHub Pages, `main` branch (root)
- **Public URL:** https://ouomoxo.github.io/website-fable/

## Release procedure (each deploy)
1. Rebuild the hero asset offline (two-step):
   `node tools/sculpt-figure.mjs <repo> hi` → `node tools/bake-monument.mjs <repo>`
2. Validate headless (Playwright/Chromium): scroll sweep fwd/back,
   keyboard Home/End, nav, sound toggle, STILL, reduced-motion, WebGL
   fallback, desktop + portrait key frames. No console errors.
3. Commit on the development branch; fast-forward `main`; push.
4. Hard-refresh the public URL; verify title, chapter copy, that the new
   `monument.glb` loads and KATABASIS/ANAMNESIS are absent.

## Verification checklist
- [x] Public HTML `<title>` = AFTER EMELYN
- [x] Chapter copy present (movements I–V)
- [x] `assets/models/monument.glb` (volumetric figure) is the loaded asset
- [x] Obsolete lucy/igea assets and ANAMNESIS posters removed
- [x] No stale service worker / cache (no SW registered)
- [x] Mobile portrait deployment framed and legible
- [x] No critical console errors across validation modes

## Recorded at release
Branch, commit hash, and deploy time are recorded in the git history of
this file's accompanying commit and the `main` fast-forward.
