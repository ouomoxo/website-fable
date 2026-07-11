# ANAMNESIS — performance budget

- Initial payload: HTML+CSS+JS ≈ 1.4 MB (three.js dominant), fonts 3×~50 KB.
- Sculpture: hi tier 3.65 MB, lo (touch) tier 1.30 MB, loaded during the
  loader with real progress; nothing else blocks entry.
- Textures: computed on canvas at 512 (desktop) / 384 (touch); no image files.
- Geometry: ≤ 470k tris resident worst case (hall, hi tier); chambers are
  visibility-culled by scroll range so typical frames draw far less.
- Device tiers: touch → lo GLBs, smaller textures, reduced dust; adaptive
  pixel-ratio drop (×0.72) if sustained frame time > 34 ms.
- Fallbacks: reduced-motion honored + STILL toggle (instant scroll, no sway);
  no-WebGL → designed static page.
