// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — builders
// (The monument itself is carved in monument.js.)
// ═══════════════════════════════════════════════════════════════

export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
