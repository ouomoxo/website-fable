// ═══════════════════════════════════════════════════════════════
// KATABASIS — builders
// Everything here is carved procedurally: columns with entasis,
// stairs, plinths, ruins, and veiled figures draped by mathematics.
// (The wings live in wings.js.)
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
import { fbmFactory } from './materials.js';

const fbm = fbmFactory(1234, 4);
const fbmB = fbmFactory(777, 4);

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ── fluted column ──────────────────────────────────────────────
// Doric-inspired: entasis swell, 20 flutes, square abacus.

export function buildColumn({ height = 11, radius = 0.55, flutes = 20 } = {}) {
  const radial = flutes * 5;
  const heightSeg = 24;
  const shaftH = height * 0.86;
  const shaft = new THREE.CylinderGeometry(1, 1, shaftH, radial, heightSeg, true);
  const pos = shaft.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = v.y / shaftH + 0.5;                       // 0 bottom → 1 top
    const theta = Math.atan2(v.z, v.x);
    // entasis: slight swell at 1/3 height, taper toward capital
    const entasis = 1 + 0.045 * Math.sin(y01 * Math.PI * 0.9) - 0.16 * y01;
    // flutes: concave scallops
    const flute = 1 - 0.055 * Math.pow(0.5 + 0.5 * Math.cos(theta * flutes), 0.8);
    const r = radius * entasis * flute;
    v.x = Math.cos(theta) * r;
    v.z = Math.sin(theta) * r;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  shaft.translate(0, shaftH / 2, 0);
  shaft.computeVertexNormals();

  // echinus (flared cushion) + abacus (square slab)
  const echinus = new THREE.CylinderGeometry(radius * 1.18, radius * 0.82, height * 0.045, radial / 2);
  echinus.translate(0, shaftH + height * 0.0225, 0);
  const abacus = new THREE.BoxGeometry(radius * 2.7, height * 0.05, radius * 2.7);
  abacus.translate(0, shaftH + height * 0.045 + height * 0.025, 0);
  // base
  const base = new THREE.CylinderGeometry(radius * 1.12, radius * 1.22, height * 0.05, radial / 2);
  base.translate(0, height * 0.025, 0);
  // fix: shaft should sit on base
  shaft.translate(0, height * 0.05, 0);
  echinus.translate(0, height * 0.05, 0);
  abacus.translate(0, height * 0.05, 0);

  const merged = mergeGeometries([shaft, echinus, abacus, base]);
  merged.computeBoundingSphere();
  [shaft, echinus, abacus, base].forEach((g) => g.dispose());
  return merged;
}

// ── broken column (standing stump, jagged crown) ───────────────

export function buildBrokenColumn({ height = 5, radius = 0.55, flutes = 20, seed = 1 } = {}) {
  const rand = seededRandom(seed * 7919);
  const radial = flutes * 4;
  const heightSeg = 20;
  const geo = new THREE.CylinderGeometry(1, 1, 1, radial, heightSeg, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const phase = rand() * 10;
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = v.y + 0.5;
    const theta = Math.atan2(v.z, v.x);
    const flute = 1 - 0.055 * Math.pow(0.5 + 0.5 * Math.cos(theta * flutes), 0.8);
    // jagged crown line
    const crown = 1 - 0.22 * Math.pow(fbm(Math.cos(theta) * 1.5 + phase, Math.sin(theta) * 1.5), 1.2);
    const yy = y01 * height * (y01 > 0.92 ? crown : 1);
    const taper = 1 - 0.10 * y01;
    let r = radius * flute * taper;
    // chips near the break
    if (y01 > 0.7) {
      r -= radius * 0.25 * Math.max(0, fbm(theta * 2 + phase, yy * 0.8) - 0.55) * ((y01 - 0.7) / 0.3);
    }
    v.x = Math.cos(theta) * r;
    v.z = Math.sin(theta) * r;
    v.y = yy;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// ── fallen drum (a column section lying on the floor) ──────────

export function buildDrum({ radius = 0.55, length = 1.6, flutes = 20, seed = 2 } = {}) {
  const rand = seededRandom(seed * 104729);
  const phase = rand() * 10;
  const geo = new THREE.CylinderGeometry(radius, radius, length, flutes * 3, 6, false);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const theta = Math.atan2(v.z, v.x);
    const rr = Math.hypot(v.x, v.z);
    if (rr > 0.01) {
      const flute = 1 - 0.05 * Math.pow(0.5 + 0.5 * Math.cos(theta * flutes), 0.8);
      const chip = 1 - 0.12 * Math.max(0, fbmB(theta * 1.8 + phase, v.y * 1.2) - 0.5);
      v.x = Math.cos(theta) * rr * flute * chip;
      v.z = Math.sin(theta) * rr * flute * chip;
    }
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.rotateZ(Math.PI / 2);   // lie down
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
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
  const merged = scaleUV(mergeGeometries([base, mid, cap]), Math.max(1, w / 1.4), Math.max(1, h / 1.4));
  [base, mid, cap].forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// ── veiled figure ──────────────────────────────────────────────
// A standing body under cloth, modelled as a radial field:
// silhouette profile + draped folds. `pose` differentiates the
// three: 'witness' (upright), 'orant' (arms raised), 'mourner'
// (bowed head).

export function buildVeiledFigure({ height = 3.2, seed = 5, pose = 'witness' } = {}) {
  const rand = seededRandom(seed * 31337);
  const phase = rand() * 20;
  const noise = fbmFactory(seed * 913 + 3, 4);

  const radial = 112;
  const rows = 150;
  const geo = new THREE.CylinderGeometry(1, 1, 1, radial, rows, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  const bow = pose === 'mourner' ? 1 : pose === 'orant' ? 0.25 : pose === 'ascendant' ? -0.22 : 0.45;
  const armLift = pose === 'orant' ? 1 : 0;
  const S = height;

  const W = S * 0.56;   // breadth factor — monumental, not slender

  // silhouette: radius of the veiled body at normalized height y (0 floor → 1 crown)
  function bodyR(y) {
    const head     = 0.085 * gauss(y, 0.955, 0.075);
    const neckDip  = -0.07 * gauss(y, 0.85, 0.05);
    const shoulder = 0.155 * gauss(y, 0.77, 0.10);
    const chest    = 0.07 * gauss(y, 0.63, 0.13);
    const waist    = -0.03 * gauss(y, 0.50, 0.09);
    const hip      = 0.065 * gauss(y, 0.40, 0.12);
    const pool     = 0.17 * Math.pow(Math.max(0, 1 - y / 0.18), 1.5);  // cloth pooling at the base
    const trunk    = 0.185 - 0.028 * y;
    return (trunk + head + neckDip + shoulder + chest + waist + hip + pool) * W;
  }

  function gauss(x, c, w) {
    const t = (x - c) / w;
    return Math.exp(-t * t);
  }

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = Math.min(1, Math.max(0, v.y + 0.5));
    const theta = Math.atan2(v.z, v.x);

    let r = bodyR(y01);

    // raised arms (orant): two vertical ridges rising past the shoulders
    if (armLift > 0) {
      const armA = gauss(angDist(theta, 2.35), 0, 0.30) + gauss(angDist(theta, -2.35 + Math.PI * 2), 0, 0.30);
      r += armLift * 0.10 * W * armA * gauss(y01, 0.86, 0.14);
    }

    // folds vanish at the crown so the veil reads taut over the head
    const crownFade = 1 - smoothstep01((y01 - 0.86) / 0.10);

    // drapery folds: vertical ridges, deeper toward the hem, pinched at shoulders
    const foldFreq = 7 + (seed % 3);
    const foldDepth = 0.105 * W * (0.3 + 0.7 * Math.pow(1 - y01, 1.1)) * crownFade;
    const fold = Math.pow(0.5 + 0.5 * Math.sin(theta * foldFreq + phase + noise(theta * 1.2, y01 * 2.5) * 4.0), 1.4);
    r += foldDepth * (fold - 0.5);

    // secondary finer pleats between the deep folds
    const pleat = Math.pow(0.5 + 0.5 * Math.sin(theta * (foldFreq * 2.6) - phase * 1.7 + noise(theta * 2.1, y01 * 4.0) * 3.0), 2.0);
    r += 0.032 * W * (pleat - 0.5) * (0.4 + 0.6 * (1 - y01)) * crownFade;

    // fine cloth ripple
    r += 0.014 * W * (noise(theta * 4 + phase, y01 * 9) - 0.5) * crownFade;

    v.x = Math.cos(theta) * r;
    v.z = Math.sin(theta) * r * 0.86;   // bodies are narrower front-to-back
    v.y = y01 * S;

    // head bow: crown leans forward (−z), spine curves gently
    const lean = Math.pow(Math.max(0, (y01 - 0.55) / 0.45), 2.2);
    v.z -= bow * 0.31 * W * lean;
    v.y -= bow * 0.05 * S * lean * lean;

    pos.setXYZ(i, v.x, v.y, v.z);
  }

  // crown cap: small dome sealing the top, radius matched to the taut veil
  const cap = new THREE.SphereGeometry(1, radial, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const cpos = cap.attributes.position;
  const topR = bodyR(1.0);
  for (let i = 0; i < cpos.count; i++) {
    v.fromBufferAttribute(cpos, i);
    v.x *= topR;
    v.z *= topR * 0.86;                 // match the body's elliptical section
    v.y = v.y * topR * 0.55 + S;
    // apply same bow to the cap
    v.z -= bow * 0.31 * W;
    v.y -= bow * 0.05 * S;
    cpos.setXYZ(i, v.x, v.y, v.z);
  }

  geo.computeVertexNormals();
  weldSeamNormals(geo, radial, rows);
  cap.computeVertexNormals();
  weldSeamNormals(cap, radial, 12);

  const merged = mergeGeometries([geo, cap]);
  geo.dispose();
  cap.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// average normals along the theta seam of a cylinder/sphere grid so
// cloth reads as one continuous surface
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

function angDist(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function smoothstep01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}

// ── architrave beam ────────────────────────────────────────────

export function scaleUV(geo, su, sv) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
  return geo;
}

export function buildArchitrave({ length = 10, h = 1.1, d = 1.2 } = {}) {
  const beam = new THREE.BoxGeometry(length, h * 0.7, d);
  beam.translate(0, h * 0.35, 0);
  const crown = new THREE.BoxGeometry(length, h * 0.3, d * 1.15);
  crown.translate(0, h * 0.85, 0);
  const merged = scaleUV(mergeGeometries([beam, crown]), length / 2.5, 1);
  [beam, crown].forEach((g) => g.dispose());
  merged.computeBoundingSphere();
  return merged;
}

// ── rubble field ───────────────────────────────────────────────

export function buildRubble({ count = 40, area = 18, seed = 3 } = {}) {
  const rand = seededRandom(seed * 2654435761);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const s = 0.07 + rand() * rand() * 0.34;
    const g = new THREE.IcosahedronGeometry(s, 1);          // keep it angular — broken stone, not pebbles
    const p = g.attributes.position;
    const v = new THREE.Vector3();
    const ph = rand() * 10;
    for (let j = 0; j < p.count; j++) {
      v.fromBufferAttribute(p, j);
      const d = 1 + 0.55 * (fbm(v.x * 2.2 + ph, v.y * 2.2 - ph) - 0.5);
      v.multiplyScalar(d);
      v.y *= 0.72;                                          // flattened shards
      p.setXYZ(j, v.x, v.y, v.z);
    }
    const a = rand() * Math.PI * 2;
    const rr = Math.pow(rand(), 0.65) * area;               // cluster toward the fall line
    g.rotateX(rand() * Math.PI);
    g.rotateY(rand() * Math.PI);
    g.translate(Math.cos(a) * rr, s * 0.22, Math.sin(a) * rr * 0.7);
    parts.push(g);
  }
  const merged = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  merged.computeVertexNormals();
  merged.computeBoundingSphere();
  return merged;
}

// ── pediment (triangular gable fragment) ───────────────────────

export function buildPediment({ width = 9, height = 2.2, depth = 1.0 } = {}) {
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2, 0);
  shape.lineTo(width / 2, 0);
  shape.lineTo(width * 0.06, height);
  shape.lineTo(-width * 0.1, height * 0.92);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
