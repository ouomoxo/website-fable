# Architecture — AFTER EMELYN

Static site, no build step. ES modules with an import map; three.js r160
vendored under `js/lib/`.

```
index.html          markup: loader, fallback, chrome, nav, five chapters
css/main.css        design system (type, chrome, chapters, responsive)
js/main.js          boot, quality tiers, scroll→progress, frame loop, probe
js/world.js         the one scene: ground/niche, monument assembly, light rig
js/monument.js      procedural carving: drape, wings, hair coil, pedestal, base
js/assets.js        GLB loading (meshopt) + normalization + mineral tinting
js/materials.js     computed textures (marble/limestone/bump) + material set
js/camera.js        shot list (S01–S10), sampling, portrait offsets
js/effects.js       single post pass: ACES, split grade, grain, vignette
js/audio.js         optional, opt-in ambience (WebAudio, no assets)
js/builders.js      small helpers (UV scaling)
```

## Flow

1. `main.js` builds the quality profile (dpr, texture size, asset tier,
   geometry detail) from pointer type and devicePixelRatio.
2. The loader runs `world.buildSteps` sequentially with a progress bar:
   load hand GLB → materials → ground/niche → monument → lights.
3. Scroll maps to damped progress p ∈ [0,1]. `CameraRig.update(p)`
   samples the shot list; `World.update(p)` drives only the light-day.
4. One render into an HDR target, one grade pass to screen.

## Contracts

- The monument is built in world coordinates against a slab top at
  y = 1.94; the wing builder receives root/yaw/dive and performs its own
  slab rest-clamp in world space.
- The figure never animates. Anything that moves lives in the camera or
  the light rig — enforced by keeping the monument group free of
  per-frame code.
- `?probe` exposes `window.__KB` (jump/frame/info/pick) for the
  screenshot validation loop; it is inert in normal visits.
