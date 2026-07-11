// ═══════════════════════════════════════════════════════════════
// ANAMNESIS — builders
// The architectural stone: columns, stairs and plinths.
// (The carved wing lives in wings.js; the sculptures are scans,
// prepared in assets.js.)
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
import { fbmFactory } from './materials.js';

// ── Doric column ───────────────────────────────────────────────
// Restrained proportion: entasis swell, twenty flutes with firm
// arrises, a plain echinus and abacus. Quiet erosion — the stone
// is old, not ruined.

export function buildColumn({ height = 15, radius = 1.3, flutes = 20, seed = 2 } = {}) {
  const noise = fbmFactory(seed * 733 + 11, 4);
  const radial = flutes * 6;
  const rows = 34;
  const shaftH = height * 0.94;
  const shaft = new THREE.CylinderGeometry(1, 1, 1, radial, rows, true);
  const pos = shaft.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = v.y + 0.5;
    const theta = Math.atan2(v.z, v.x);
    // entasis: slight swell at one third, taper toward the capital
    const entasis = 1 + 0.035 * Math.sin(y01 * Math.PI * 0.9) - 0.165 * y01;
    // flutes: concave scallops meeting in firm arrises
    const flute = 1 - 0.042 * Math.pow(0.5 + 0.5 * Math.cos(theta * flutes), 0.8);
    // quiet age: faint irregularity, a little more near the foot
    const wear = 1 + (noise(theta * 2.1 + seed, y01 * 6.5) - 0.5) * 0.014 * (1.3 - y01 * 0.8);
    const r = radius * entasis * flute * wear;
    v.x = Math.cos(theta) * r;
    v.z = Math.sin(theta) * r;
    v.y = y01 * shaftH;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  shaft.computeVertexNormals();
  weldSeamNormals(shaft, radial, rows);

  const topR = radius * (1 + 0.035 * Math.sin(Math.PI * 0.9) - 0.165);
  const echinus = new THREE.CylinderGeometry(radius * 1.24, topR * 0.98, height * 0.028, radial / 2);
  echinus.translate(0, shaftH + height * 0.014, 0);
  const abacus = new THREE.BoxGeometry(radius * 2.75, height * 0.032, radius * 2.75);
  abacus.translate(0, shaftH + height * 0.028 + height * 0.016, 0);

  const merged = mergeGeometries([shaft, echinus, abacus]);
  [shaft, echinus, abacus].forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// average normals along the theta seam so the shaft reads as one
// continuous surface
function weldSeamNormals(geo, radial, rows) {
  const n = geo.attributes.normal;
  const cols = radial + 1;
  for (let row = 0; row <= rows; row++) {
    const a = row * cols;
    const b = row * cols + radial;
    if (b >= n.count) break;
    const nx = (n.getX(a) + n.getX(b)) / 2;
    const ny = (n.getY(a) + n.getY(b)) / 2;
    const nz = (n.getZ(a) + n.getZ(b)) / 2;
    const len = Math.hypot(nx, ny, nz) || 1;
    n.setXYZ(a, nx / len, ny / len, nz / len);
    n.setXYZ(b, nx / len, ny / len, nz / len);
  }
  n.needsUpdate = true;
}

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
