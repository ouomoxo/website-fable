// ═══════════════════════════════════════════════════════════════
// KATABASIS — builders
// Stairs, plinths, and the veiled figures — a standing body under
// cloth, modelled as a radial field with baked cavity shading.
// (The wings live in wings.js.)
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { mergeGeometries } from './lib/BufferGeometryUtils.js';
import { fbmFactory } from './materials.js';

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

// ── veiled figure ──────────────────────────────────────────────
// Silhouette profile + draped folds that wander diagonally, with
// ambient occlusion baked into vertex colors so the cloth reads
// under a single light. `pose`: 'witness' (bowed, veiled head),
// 'nike' (headless — the body breaks off above the shoulders).

export function buildVeiledFigure({ height = 3.2, seed = 5, pose = 'witness', detail = 1 } = {}) {
  const rand = seededRandom(seed * 31337);
  const phase = rand() * 20;
  const noise = fbmFactory(seed * 913 + 3, 4);

  const radial = Math.max(96, Math.round(168 * detail));
  const rows = Math.max(120, Math.round(230 * detail));
  const geo = new THREE.CylinderGeometry(1, 1, 1, radial, rows, true);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();

  const isNike = pose === 'nike';
  const bow = pose === 'mourner' ? 1 : isNike ? -0.20 : 0.45;
  const yTop = isNike ? 0.80 : 1.0;      // nike: the profile ends at the break
  const S = height;
  const W = (S / yTop) * 0.54 * (isNike ? 0.8 : 1);
  // jagged break line, shared by the body's top rows and the cap rim
  const jagAmp = 0.045 * S;
  const jag = (theta) => (noise(Math.cos(theta) * 1.7 + phase, Math.sin(theta) * 1.7) - 0.5) * 2 * jagAmp;

  // silhouette: radius of the veiled body at normalized height y
  function bodyR(y) {
    const head     = 0.066 * gauss(y, 0.945, 0.078);
    const neckDip  = -0.072 * gauss(y, 0.845, 0.052);
    const shoulder = 0.180 * gauss(y, 0.760, 0.105);
    const chest    = 0.060 * gauss(y, 0.62, 0.125);
    const waist    = -0.020 * gauss(y, 0.50, 0.085);
    const hip      = 0.062 * gauss(y, 0.385, 0.12);
    const pool     = 0.165 * Math.pow(Math.max(0, 1 - y / 0.17), 1.55);
    const trunk    = 0.184 - 0.024 * y;
    return (trunk + head + neckDip + shoulder + chest + waist + hip + pool) * W;
  }

  const nF = 6 + (seed % 2);
  const colors = new Float32Array(pos.count * 3);
  const sway = (y) => 0.030 * W * Math.sin(y * Math.PI * 0.9);   // contrapposto drift

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const y01 = Math.min(1, Math.max(0, v.y + 0.5));
    const yb = y01 * yTop;                 // position on the notional full body
    const theta = Math.atan2(v.z, v.x);

    let r = bodyR(yb);

    // folds vanish over the head and neck so the veil reads taut
    const crownFade = isNike ? 1 : 1 - smoothstep01((yb - 0.78) / 0.14);

    // major folds: narrow ridges, wide valleys, drifting diagonally —
    // taut over the head and shoulders, cascading toward the hem
    const swirl = (noise(theta * 0.7 + phase, yb * 1.6) - 0.5) * 2.1 * (1 - yb * 0.55);
    const th2 = theta + swirl + (1 - yb) * 0.5;
    const azim = 0.6 + 0.75 * noise(Math.cos(theta) * 1.1 + phase, Math.sin(theta) * 1.3);
    const taper = isNike ? 1 : 1 - 0.38 * smoothstep01((yb - 0.55) / 0.35);
    const ridge = Math.pow(0.5 + 0.5 * Math.sin(th2 * nF + phase), 1.6);
    const depth = (isNike ? 0.105 : 0.082) * W * (0.22 + 0.78 * Math.pow(1 - yb, 1.15)) * crownFade * azim * taper;
    r += depth * (ridge - 0.42);

    // secondary pleats between the deep folds
    const pleat = Math.pow(0.5 + 0.5 * Math.sin(th2 * nF * 2.7 - phase * 1.7 + noise(theta * 2.1, yb * 4.0) * 3.2), 2.4);
    r += 0.020 * W * (pleat - 0.5) * (0.35 + 0.65 * (1 - yb)) * crownFade;

    // fine cloth ripple
    r += 0.008 * W * (noise(theta * 4 + phase, yb * 9) - 0.5) * crownFade;

    const zScale = 0.80 + 0.10 * Math.pow(1 - yb, 1.3);
    v.x = Math.cos(theta) * r + sway(yb);
    v.z = Math.sin(theta) * r * zScale;
    v.y = y01 * S;
    if (isNike) v.y += jag(theta) * smoothstep01((y01 - 0.88) / 0.12);

    // head bow / lift: crown leans, spine curves gently
    const lean = Math.pow(Math.max(0, (yb - 0.55) / 0.45), 2.2);
    v.z -= bow * 0.31 * W * lean;
    v.y -= Math.abs(bow) * 0.05 * S * lean * lean;

    pos.setXYZ(i, v.x, v.y, v.z);

    // baked cavity shading: valleys darker, hem grounded, neck shaded
    const cav = (1 - ridge) * crownFade;
    const pleatCav = (1 - pleat) * crownFade;
    let ao = 1 - (0.30 * cav + 0.10 * pleatCav) * (0.35 + 0.65 * (1 - yb));
    if (!isNike) ao *= 1 - 0.16 * gauss(yb, 0.845, 0.05);
    ao *= 0.86 + 0.14 * smoothstep01(yb / 0.09);
    colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = ao;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // cap: for the veiled head a taut dome; for the nike a raw break
  const capSegs = 12;
  const cap = new THREE.SphereGeometry(1, radial, capSegs, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const cpos = cap.attributes.position;
  const topR = bodyR(yTop);
  const leanTop = Math.pow(Math.max(0, (yTop - 0.55) / 0.45), 2.2);
  for (let i = 0; i < cpos.count; i++) {
    v.fromBufferAttribute(cpos, i);
    const theta = Math.atan2(v.z, v.x);
    const rimness = Math.hypot(v.x, v.z);          // 1 at rim → 0 at centre
    v.x = v.x * topR + sway(yTop);
    v.z *= topR * 0.80;
    if (isNike) {
      // broken stone: nearly flat, jagged at the rim, dished toward centre
      v.y = S + jag(theta) * rimness
          - (1 - rimness) * 0.035 * S
          + (noise(v.x * 2.1 + phase, v.z * 2.1) - 0.5) * 0.05 * S * (1 - rimness);
    } else {
      v.y = v.y * topR * 0.36 + S;
    }
    v.z -= bow * 0.31 * W * leanTop;
    v.y -= Math.abs(bow) * 0.05 * S * leanTop * leanTop;
    cpos.setXYZ(i, v.x, v.y, v.z);
  }
  const capColors = new Float32Array(cpos.count * 3).fill(isNike ? 0.16 : 0.97);
  cap.setAttribute('color', new THREE.BufferAttribute(capColors, 3));

  geo.computeVertexNormals();
  weldSeamNormals(geo, radial, rows);
  cap.computeVertexNormals();
  weldSeamNormals(cap, radial, capSegs);

  const merged = mergeGeometries([geo, cap]);
  geo.dispose();
  cap.dispose();
  merged.computeBoundingSphere();
  return merged;
}

// average normals along the theta seam so cloth reads as one surface
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

function gauss(x, c, w) {
  const t = (x - c) / w;
  return Math.exp(-t * t);
}

function smoothstep01(t) {
  t = Math.min(1, Math.max(0, t));
  return t * t * (3 - 2 * t);
}
