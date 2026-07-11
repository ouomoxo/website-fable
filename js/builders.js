// ═══════════════════════════════════════════════════════════════
// KATABASIS — builders
// The architectural stone: stairs and plinths.
// (The carved wing lives in wings.js; the sculptures are scans,
// prepared in assets.js.)
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';

// ── stairs ─────────────────────────────────────────────────────

export function buildStairs({ width = 12, steps = 12, rise = 0.5, run = 1.2 } = {}) {
  const parts = [];
  for (let i = 0; i < steps; i++) {
    const s = new THREE.BoxGeometry(width, rise, run + 0.001);
    s.translate(0, -rise / 2 - i * rise, -run / 2 - i * run);
    parts.push(s);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// ── plinth ─────────────────────────────────────────────────────

export function buildPlinth({ w = 2.2, h = 1.6, d = 2.2 } = {}) {
  const base = new THREE.BoxGeometry(w * 1.25, h * 0.16, d * 1.25);
  base.translate(0, h * 0.08, 0);
  const mid = new THREE.BoxGeometry(w, h * 0.72, d);
  mid.translate(0, h * 0.16 + h * 0.36, 0);
  const cap = new THREE.BoxGeometry(w * 1.15, h * 0.12, d * 1.15);
  cap.translate(0, h * 0.88 + h * 0.06, 0);
  const merged = mergeGeometries([base, mid, cap]);
  [base, mid, cap].forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}
