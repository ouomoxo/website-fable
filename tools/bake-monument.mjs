// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — offline monument bake
//
// Carves the entire monument at high resolution in world space,
// bakes ambient occlusion (analytic cavities + proxy-shape sky
// occlusion + contact darkening) into vertex colors, and exports
// meshopt-compressed GLBs (hi and lo tiers).
//
// Run from a directory whose node_modules provides
// @gltf-transform/* and meshoptimizer:
//   node bake-monument.mjs <repo-root>
// Writes <repo>/assets/models/monument.glb and monument-lo.glb.
// ═══════════════════════════════════════════════════════════════

import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { simplify, reorder, prune } from '@gltf-transform/functions';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { readFileSync } from 'fs';

const REPO = process.argv[2] ?? '/home/user/website-fable';
const THREE = await import(`${REPO}/js/lib/three.module.min.js`);

// ── seeded value noise (matches js/materials.js) ───────────────
function makeNoise(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = xi & (SIZE - 1), y0 = yi & (SIZE - 1);
    const x1 = (x0 + 1) & (SIZE - 1), y1 = (y0 + 1) & (SIZE - 1);
    const a = grid[y0 * SIZE + x0], b = grid[y0 * SIZE + x1];
    const c = grid[y1 * SIZE + x0], d = grid[y1 * SIZE + x1];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbmFactory(seed, octaves = 5) {
  const n = makeNoise(seed);
  return function fbm(x, y) {
    let amp = 0.5, f = 1, sum = 0;
    for (let i = 0; i < octaves; i++) { sum += amp * n(x * f, y * f); amp *= 0.5; f *= 2.03; }
    return sum;
  };
}

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth01 = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const gauss = (x, c, w) => { const t = (x - c) / w; return Math.exp(-(t * t)); };
const lerp = (a, b, t) => a + (b - a) * t;

const TOP = 1.94;                  // slab top (world y)

// ═══ THE BODY DRAPE ═══════════════════════════════════════════
// Kneels behind the altar, fallen forward across its top.
function buildBodyDrape(detail) {
  const noise = fbmFactory(331 * 7 + 7, 4);
  const U = Math.round(230 * detail), V = Math.round(165 * detail);
  const geo = new THREE.PlaneGeometry(1, 1, U, V);
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count);

  const L = 3.75;
  const AX0 = -0.72, AZ0 = 0.10, AX1 = -1.04, AZ1 = 1.02;
  const adx = AX1 - AX0, adz = AZ1 - AZ0;
  const alen2 = adx * adx + adz * adz;

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;
    const s = 0.5 - pos.getY(i);
    const x = (u - 0.5) * L;

    const head      = 0.30 * gauss(u, 0.20, 0.12);
    const shoulders = 0.56 * gauss(u, 0.38, 0.17);
    const back      = 0.28 * gauss(u, 0.62, 0.22);
    const taper     = smooth01((u - 0.78) / 0.22);
    const endPinch  = smooth01((u - 0.80) / 0.20);
    const crest = TOP + 0.08 * (1 - endPinch) + 0.01
                + (head * 0.55 + shoulders + back) * (1 - 0.82 * taper) * (1 - endPinch);

    const kneel = 1.32 + 0.5 * gauss(u, 0.40, 0.30) * (1 - taper);
    const zB = -kneel * (1 - endPinch) - 0.92 * endPinch;
    const yB = 0.03 * (1 - endPinch) + (TOP + 0.015) * endPinch;
    const hemDrop = 1 - smooth01((u - 0.40) / 0.22);
    const drop2 = smooth01((hemDrop - 0.45) / 0.40);
    const yF0 = 1.30 - 0.22 * noise(u * 3.1, 7) - 0.45 * smooth01((-1.35 - x) / 0.55);
    const yF = 1.96 + (yF0 - 1.96) * drop2;
    const zF = (0.62 + 0.55 * hemDrop) * (1 - drop2) + 1.26 * drop2;
    const zC = -0.10 - 0.30 * (shoulders / 0.56);

    const p1y = 2 * crest - (yB + yF) / 2;
    const p1z = 2 * zC - (zB + zF) / 2;
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    let z = a * zB + b * p1z + c * zF;
    let y = a * yB + b * p1y + c * yF;

    // flatten the crest arch a little — a body, not a balloon
    if (y > TOP + 0.22) {
      const over = y - (TOP + 0.22);
      y = TOP + 0.22 + over * (1 - 0.22 * smooth01(over / 0.6));
    }

    // land against the stone
    {
      const k = smooth01((1.96 - y) / 0.22);
      if (s > 0.55) z = z + (Math.max(z, 1.22) - z) * k;
      else if (s < 0.45) z = z + (Math.min(z, -1.14) - z) * k;
    }

    // folds: primary gutters + secondaries + crinkle
    const fallF = smooth01((s - 0.62) / 0.38);
    const fallB = smooth01((0.30 - s) / 0.30);
    const foldZone = Math.max(fallF, fallB) * smooth01((1.90 - y) / 0.25);
    const swirl = (noise(u * 2.0 + 9, s * 1.3) - 0.5) * 2.0;
    const ridge = Math.pow(0.5 + 0.5 * Math.sin(x * 15 + swirl + s * 1.6), 2.0);
    const dir = s < 0.45 ? -1 : 1;
    z += dir * 0.11 * foldZone * (ridge - 0.42) * (0.5 + 0.5 * noise(u * 1.7, 3.3));
    z += dir * 0.024 * foldZone * Math.sin(x * 42 + swirl * 2.2) * (0.4 + 0.6 * noise(u * 4.1, s * 2 + 5));
    z += dir * foldZone * (noise(u * 7 + 1, s * 5 + 3) - 0.5) * 0.05;

    // radial pipe folds fanning from the wrist where cloth breaks
    // over the lip — classic drapery language
    if (s > 0.55) {
      const dxw = x + 1.04, dzw = z - 1.15;
      const ang = Math.atan2(dzw, dxw);
      const rw = Math.hypot(dxw, dzw);
      const pipe = Math.pow(Math.abs(Math.sin(ang * 5.5 + noise(rw * 2, 3) * 1.6)), 1.6);
      z += 0.028 * foldZone * (pipe - 0.5) * smooth01((0.9 - rw) / 0.6) * drop2;
    }

    // pooling at the ground
    const pool = Math.max(smooth01((0.06 - s) / 0.06), 0);
    z -= pool * 0.10 * (0.4 + 0.6 * noise(u * 3.3, 11));

    // sleeve over the wrist
    z += gauss(x, -1.03, 0.10) * smooth01((s - 0.70) / 0.30) * hemDrop * 0.15;

    // the draped arm, only on the slab top
    if (y > TOP + 0.01 && z > -0.4 && fallF < 0.35) {
      let t = ((x - AX0) * adx + (z - AZ0) * adz) / alen2;
      t = clamp01(t);
      const dxr = x - (AX0 + adx * t), dzr = z - (AZ0 + adz * t);
      const d2 = dxr * dxr + dzr * dzr;
      y += 0.16 * Math.exp(-d2 / (0.14 * 0.14)) * (0.85 + 0.3 * t);
      const hx = x + 1.10, hz = z - 0.38;
      y += 0.13 * Math.exp(-(hx * hx / 0.32 + hz * hz / 0.10));
    }

    // tension wrinkles over the back
    if (y > TOP + 0.06) {
      const stretch = (1 - foldZone) * smooth01((y - TOP - 0.06) / 0.3);
      y += 0.013 * stretch * Math.sin(x * 9 + z * 5 + swirl * 1.5) * (0.4 + 0.6 * noise(x * 2.2, z * 2.2 + 4));
    }

    // fine ripple, quiet at the lip
    const fineGate = 0.25 + 0.75 * smooth01((1.86 - y) / 0.22);
    const fine = (noise(u * 9 + 3, s * 7) - 0.5) * 0.015 * fineGate;
    y += fine; z += fine;

    pos.setXYZ(i, x, Math.max(y, 0.03), z);
    ao[i] = 1 - 0.30 * foldZone * (1 - ridge) - 0.10 * pool;
  }
  geo.computeVertexNormals();
  return { geo, ao };
}

// ═══ THE WING ═════════════════════════════════════════════════
// A solid vane with radiating feather relief, PLUS separated
// feather tips along the trailing edge so the silhouette breaks
// into real feathers. Built in world space (mirror/dive/yaw).
function buildWing({ span, chord, rise, droop, root, yaw, dive, mirror = false, seedO = 5, detail, folded = 0, rest = true }) {
  const noise = fbmFactory(seedO * 613 + 11, 4);
  const nF = 15;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cd = Math.cos(dive), sd = Math.sin(dive);

  const xform = (x, y, z) => {
    if (mirror) x = -x;
    const x1 = x * cd - y * sd;
    const y1 = x * sd + y * cd;
    const x2 = x1 * cy + z * sy;
    const z2 = -x1 * sy + z * cy;
    return [x2 + root[0], y1 + root[1], z2 + root[2]];
  };

  const leading = (u) => {
    const lx = u * span;
    const ly = rise * Math.sin(Math.min(u * 2.2, 1) * Math.PI / 2)
             - droop * Math.pow(Math.max(0, u - 0.10) / 0.90, 1.55);
    const lz = (-0.14 + 0.18 * Math.sin(u * Math.PI)) * (1 - folded * 0.6);
    return [lx, ly, lz];
  };
  const chordLen = (u) => chord
    * (0.24 + 0.72 * Math.sin(Math.min(u * 1.18, 1) * Math.PI * 0.64))
    * (1 - 0.62 * smooth01((u - 0.82) / 0.18))
    * (1 - 0.2 * folded);

  const surf = (u, w) => {
    const [lx, ly, lz] = leading(u);
    const cLen = chordLen(u);
    const ang = Math.atan2(w * 1.05, u + 0.06);
    const fi = ang / (Math.PI / 2) * nF;
    const r0 = fi - Math.floor(fi);
    const notch = Math.pow(0.5 + 0.5 * Math.cos((r0 - 0.5) * Math.PI * 2), 1.5);
    const notchCut = 0.06 * (1 - smooth01((u - 0.78) / 0.20));
    const cEff = w * (1 - notchCut * notch * smooth01((w - 0.70) / 0.30));
    const lean = 0.40 - 0.20 * u + 0.24 * cEff;
    const dy = -Math.cos(lean), dz = Math.sin(lean) * (1 - folded * 0.5);
    let x = lx + (0.30 + 0.55 * u) * cEff * cLen * 0.45;
    let y = ly + dy * cEff * cLen;
    let z = lz + dz * cEff * cLen;
    const rise2 = smooth01((w - 0.16) / 0.30) * smooth01((u + w * 0.6 - 0.10) / 0.20);
    const ridge = gauss(r0, 0.5, 0.12);
    const seam = smooth01((Math.abs(r0 - 0.5) - 0.34) / 0.14);
    const banks = 0.011 * (smooth01((w - 0.34) / 0.10) + smooth01((w - 0.64) / 0.10));
    const relief = (0.030 * (ridge - 0.30) - 0.012 * seam) * rise2 + banks;
    const grain = (noise(u * 6 + 3, w * 5) - 0.5) * 0.012 * rise2;
    y += Math.sin(lean) * (relief + grain);
    z += Math.cos(lean) * (relief + grain);
    return { x, y, z, lean, fi, r0, ridge, seam, notch, rise2 };
  };

  const restClamp = (p, notch, relief) => {
    if (!rest) return;
    const rY = 1.955 + 0.012 * notch + relief;
    const t = smooth01((2.10 + 0.22 - Math.abs(p[0])) / 0.44)
            * smooth01((1.20 + 0.22 - Math.abs(p[2])) / 0.44);
    if (p[1] < rY && t > 0) p[1] = p[1] + (rY - p[1]) * t;
    p[1] = Math.max(p[1], 0.04);
  };

  // vane sheet: only the inner 72% of the chord — the outer part
  // becomes separated feather tips
  const U = Math.round(170 * detail), W = Math.round(40 * detail);
  const vane = new THREE.PlaneGeometry(1, 1, U, W);
  const vpos = vane.attributes.position;
  const vao = new Float32Array(vpos.count);
  for (let i = 0; i < vpos.count; i++) {
    const u = vpos.getX(i) + 0.5;
    const w = (vpos.getY(i) + 0.5) * 0.74;
    const S = surf(u, w);
    const p = xform(S.x, S.y, S.z);
    restClamp(p, S.notch, 0);
    vpos.setXYZ(i, p[0], p[1], p[2]);
    vao[i] = 1 - 0.20 * (1 - S.ridge) * S.rise2 - 0.16 * S.seam * S.rise2
               - 0.10 * smooth01((0.22 - w) / 0.22);
  }
  vane.computeVertexNormals();

  // separated feather tips: one strip per feather ray, covering
  // w 0.70 → 1.0, each narrower than its ray band so real gaps
  // open between tips
  const strips = [];
  const stripAOs = [];
  const segU = Math.max(8, Math.round(26 * detail)), segW = Math.max(3, Math.round(7 * detail));
  for (let f = 0; f < nF; f++) {
    // param ray for feather center: ang = (f+0.5)/nF * PI/2
    const angC = (f + 0.5) / nF * (Math.PI / 2);
    const tanC = Math.tan(angC);
    const strip = new THREE.PlaneGeometry(1, 1, segU, segW);
    const spos = strip.attributes.position;
    const sao = new Float32Array(spos.count);
    let degenerate = false;
    for (let i = 0; i < spos.count; i++) {
      const t = spos.getX(i) + 0.5;              // along the tip strip
      const q = spos.getY(i) + 0.5;              // across the feather
      // width shrinks toward the very end (rounded tip)
      const wHalf = (0.40 - 0.16 * t) / nF;      // in feather-index space
      const fiQ = f + 0.5 + (q - 0.5) * 2 * wHalf * nF;
      const angQ = fiQ / nF * (Math.PI / 2);
      const w = 0.70 + t * 0.30;
      // invert ang = atan2(w*1.05, u+0.06) for u at this w:
      const u = (w * 1.05) / Math.tan(angQ) - 0.06;
      if (u < 0.02 || u > 1.05) { degenerate = true; }
      const uu = Math.min(1, Math.max(0.02, u));
      const S = surf(uu, w);
      // lift tips slightly off the vane plane, drooping with t
      const lift = 0.014 + 0.022 * t;
      let y2 = S.y + Math.sin(S.lean) * lift;
      let z2 = S.z + Math.cos(S.lean) * lift;
      const p = xform(S.x, y2, z2);
      restClamp(p, 0.5, 0.012);
      spos.setXYZ(i, p[0], p[1], p[2]);
      // rachis + cup across the strip
      const cup = 1 - Math.abs(q - 0.5) * 2;
      sao[i] = 1 - 0.10 * (1 - cup) - 0.12 * smooth01((t - 0.6) / 0.4);
    }
    if (degenerate && f < 2) { continue; }       // rays that exit the root
    strip.computeVertexNormals();
    strips.push(strip);
    stripAOs.push(sao);
  }

  return { vane, vao, strips, stripAOs };
}

// ═══ HAIR ═════════════════════════════════════════════════════
function buildHair(detail) {
  const noise = fbmFactory(4 * 173 + 1, 4);
  const geo = new THREE.TorusGeometry(0.60, 0.42, Math.round(52 * detail), Math.round(130 * detail));
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.y, v.x);
    const cx = Math.cos(a) * 0.60, cyy = Math.sin(a) * 0.60;
    const tx = v.x - cx, ty = v.y - cyy;
    const radial = tx * Math.cos(a) + ty * Math.sin(a);
    const tb = Math.atan2(v.z, radial);
    const wave = noise(a * 1.3 + 5, tb * 0.7) * 2.6;
    const strand = Math.pow(Math.abs(Math.sin(tb * 4.5 + a * 3.0 + wave)), 0.6);
    const fineS = Math.pow(Math.abs(Math.sin(tb * 13 + a * 6.5 + wave * 1.7)), 0.7);
    const clump = 0.5 + 0.5 * noise(a * 2.2 + 8, tb * 1.1);
    const rr = 1 - (0.06 + 0.09 * clump) * (1 - strand) - 0.022 * (1 - fineS);
    v.multiplyScalar(rr);
    pos.setXYZ(i, v.x, v.y, v.z * 0.66);
    ao[i] = 1 - 0.20 * (1 - strand) - 0.10 * (1 - fineS) - 0.06 * (1 - clump);
  }
  // world placement (matches previous world.js transform)
  const m = new THREE.Matrix4()
    .makeTranslation(-1.28, 2.10, 0.44)
    .multiply(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(-1.25, 0.15, 0.20)))
    .multiply(new THREE.Matrix4().makeScale(0.27, 0.27, 0.27));
  geo.applyMatrix4(m);
  geo.computeVertexNormals();
  return { geo, ao };
}

// ═══ PEDESTAL (molded, tapered) + SLAB + BASE ═════════════════
// Lathe-like loft of a molding profile around a rounded-corner
// rectangle. Profile: plinth step, scotia, tapering die, cap.
function buildAltar(detail) {
  // profile: [y, inset] pairs from bottom to top (inset from the
  // outer footprint, in metres)
  // a TALL pedestal: plinth → base molding → tapering die → oversailing
  // cornice → top surface at y = 2.42
  const prof = [
    [0.30, 0.02], [0.52, 0.02],          // plinth
    [0.55, 0.055], [0.63, 0.085],        // base molding out-step
    [0.67, 0.06], [0.76, 0.075],
    [0.80, 0.185],                        // die (shaft) begins
    [1.96, 0.205],                        // shaft rises, slight entasis
    [2.02, 0.175], [2.08, 0.18],          // cornice under-step
    [2.16, 0.09], [2.24, 0.055],          // cornice oversail
    [2.34, 0.045], [2.42, 0.055],         // top
  ];
  const W2 = 1.00, D2 = 1.00;            // outer half-extents at the plinth
  const R = 0.09;                        // corner radius
  const noise = fbmFactory(881, 4);

  const NP = 96;                          // points around the perimeter
  const rows = [];
  // resample profile densely for smooth molding
  const yTop = prof[prof.length - 1][0];
  const NR = Math.round(90 * detail);
  for (let r = 0; r <= NR; r++) {
    const t = r / NR;
    const y = lerp(prof[0][0], yTop, t);
    // find segment
    let inset = prof[prof.length - 1][1];
    for (let k = 0; k < prof.length - 1; k++) {
      if (y >= prof[k][0] && y <= prof[k + 1][0]) {
        const tt = (y - prof[k][0]) / Math.max(1e-6, prof[k + 1][0] - prof[k][0]);
        inset = lerp(prof[k][1], prof[k + 1][1], tt);
        break;
      }
    }
    rows.push([y, inset]);
  }

  const positions = [], aoArr = [], indices = [], uvArr = [];
  const perim = (k, inset) => {
    // true rounded-rectangle: project the direction ray onto the
    // core box, then offset by the corner radius
    const t = k / NP * Math.PI * 2;
    const dx = Math.cos(t), dz = Math.sin(t);
    const hw = Math.max(0.05, W2 - inset - R);
    const hd = Math.max(0.05, D2 - inset - R);
    // scale ray to touch the core box boundary
    const sc = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dz) / hd);
    let px = dx * sc, pz = dz * sc;
    px = Math.max(-hw, Math.min(hw, px));
    pz = Math.max(-hd, Math.min(hd, pz));
    // offset outward by R along the direction to the ray point
    const ox = dx * sc - px, oz = dz * sc - pz;
    const ol = Math.hypot(ox, oz);
    if (ol > 1e-6) { px += ox / ol * R; pz += oz / ol * R; }
    else { px += dx * R; pz += dz * R; }
    return [px, pz];
  };
  for (let r = 0; r < rows.length; r++) {
    const [y, inset] = rows[r];
    for (let k = 0; k <= NP; k++) {
      const [px, pz] = perim(k % NP, inset);
      // stone chipping on molding edges
      const chip = (noise(px * 3.1 + y * 2, pz * 3.1) - 0.5) * 0.006;
      positions.push(px + chip, y, pz + chip);
      uvArr.push(k / NP * 4, r / rows.length);
      // cavity AO in molding recesses: compare inset to neighbors
      aoArr.push(1);
    }
  }
  const rowLen = NP + 1;
  for (let r = 0; r < rows.length - 1; r++) {
    for (let k = 0; k < NP; k++) {
      const a = r * rowLen + k, b = a + 1, c = a + rowLen, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  // molding cavity AO: darker where inset is greater than the
  // local trend (recessed bands)
  for (let r = 0; r < rows.length; r++) {
    const ins = rows[r][1];
    const insLo = rows[Math.max(0, r - 4)][1];
    const insHi = rows[Math.min(rows.length - 1, r + 4)][1];
    const cav = clamp01((ins - Math.min(insLo, insHi)) * 14);
    for (let k = 0; k <= NP; k++) aoArr[r * rowLen + k] = 1 - 0.22 * cav;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvArr, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  // top plate closing the cornice (the figure rests on this)
  const slab = new THREE.BoxGeometry(1.86, 0.10, 1.86, 30, 2, 30);
  slab.translate(0, 2.42 - 0.05, 0);
  const slabAO = new Float32Array(slab.attributes.position.count).fill(1);

  // rough-hewn base under the plinth
  const base = new THREE.BoxGeometry(2.5, 0.34, 2.5, 40, 8, 40);
  const bpos = base.attributes.position;
  const bnoise = fbmFactory(97 * 3 + 13, 4);
  const bv = new THREE.Vector3();
  for (let i = 0; i < bpos.count; i++) {
    bv.fromBufferAttribute(bpos, i);
    const cut = bnoise(bv.x * 1.7 + 3, bv.z * 1.7 - bv.y);
    const facet = Math.round(cut * 5) / 5;
    const amt = 0.09 * (0.4 + 0.6 * (0.5 - bv.y / 0.34));
    const nx = bv.x + (facet - 0.5) * amt * Math.sign(bv.x);
    const nz = bv.z + (bnoise(bv.z * 2.1, bv.x * 1.3) - 0.5) * amt * Math.sign(bv.z);
    if (bv.y > 0.34 * 0.49) continue;
    bpos.setXYZ(i, nx, bv.y, nz);
  }
  base.translate(0, 0.17, 0);
  base.computeVertexNormals();
  const baseAO = new Float32Array(base.attributes.position.count).fill(1);

  return { ped: { geo, ao: new Float32Array(aoArr) }, slab: { geo: slab, ao: slabAO }, base: { geo: base, ao: baseAO } };
}

// ═══ PROXY AMBIENT OCCLUSION ══════════════════════════════════
// Sky-visibility approximation from smooth proxy shapes: sphere
// occluders for masses, slab ceiling for everything beneath it,
// wall proximity, and contact darkening near the drape hemlines.
const SPHERES = [
  // body masses along the crest
  { c: [-1.15, 2.15, 0.10], r: 0.55, k: 0.85 },
  { c: [-0.45, 2.30, -0.10], r: 0.70, k: 0.85 },
  { c: [0.45, 2.20, -0.15], r: 0.72, k: 0.85 },
  { c: [1.25, 2.05, -0.20], r: 0.60, k: 0.8 },
  // kneeling mass behind
  { c: [-0.30, 1.00, -1.15], r: 0.85, k: 0.7 },
  { c: [0.60, 0.90, -1.10], r: 0.75, k: 0.7 },
  // wing masses
  { c: [-1.60, 2.35, 0.25], r: 0.55, k: 0.75 },
  { c: [-2.30, 1.85, 0.55], r: 0.55, k: 0.7 },
  { c: [-2.85, 1.25, 0.85], r: 0.45, k: 0.6 },
  { c: [0.2, 2.45, -0.60], r: 0.65, k: 0.6 },
  // hair
  { c: [-1.28, 2.12, 0.44], r: 0.22, k: 0.8 },
];

function proxyAO(x, y, z, nx, ny, nz, sphereScale = 1) {
  let vis = 1;
  // sphere occluders — solid angle approx, weighted by facing
  for (const s of SPHERES) {
    const dx = s.c[0] - x, dy = s.c[1] - y, dz = s.c[2] - z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < 1e-4) continue;
    const d = Math.sqrt(d2);
    if (d > 3.0) continue;
    const facing = clamp01((nx * dx + ny * dy + nz * dz) / d * 0.5 + 0.5);
    const occ = clamp01((s.r * s.r) / d2) * facing * s.k * sphereScale;
    vis *= (1 - clamp01(occ));
  }
  // slab ceiling: points below the slab, within its footprint
  if (y < TOP - 0.10 && Math.abs(x) < 2.075 && Math.abs(z) < 1.20) {
    const depth = clamp01((TOP - 0.10 - y) / 1.6);
    const inset = Math.min((2.075 - Math.abs(x)) / 0.8, (1.20 - Math.abs(z)) / 0.8, 1);
    const up = clamp01(ny * 0.5 + 0.5);
    vis *= 1 - 0.38 * clamp01(depth * 0.4 + 0.35) * clamp01(inset) * up;
  }
  // niche wall behind
  if (z < -0.8) vis *= 1 - 0.18 * clamp01((-z - 0.8) / 2.6);
  // ground proximity for down-facing surfaces
  if (y < 0.5 && ny < 0.2) vis *= 1 - 0.30 * clamp01((0.5 - y) / 0.5) * clamp01(-ny);
  return clamp01(vis);
}

// contact darkening on the slab top near the drape footprint
function slabContactAO(x, y, z) {
  if (y < 1.90) return 1;
  let ao = 1;
  // under the body: crest footprint ellipse
  const ex = x / 1.95, ez = (z + 0.15) / 0.95;
  const dBody = Math.sqrt(ex * ex + ez * ez);
  ao *= 1 - 0.55 * smooth01((1.15 - dBody) / 0.45);
  // along the front hem line
  const hem = smooth01((0.35 - Math.abs(z - 1.02)) / 0.35) * smooth01((x + 1.9) / 0.6) * smooth01((0.4 - x) / 0.7);
  ao *= 1 - 0.30 * hem;
  return ao;
}

// ═══ ASSEMBLE, BAKE, EXPORT ═══════════════════════════════════
function bakeVertexColors(geo, cavityAO, tintSeed, contactFn, opts = {}) {
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const fbm = fbmFactory(tintSeed, 4);
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
    let ao = (cavityAO ? cavityAO[i] : 1) * proxyAO(x, y, z, nx, ny, nz, opts.sphereScale ?? 1);
    if (contactFn) ao *= contactFn(x, y, z);
    ao = Math.max(opts.floor ?? 0.42, Math.min(1, ao));
    // macro mineral drift — very quiet
    const drift = (fbm(x * 1.1 + 7, y * 1.1 + z * 0.7) - 0.5) * 0.10;
    const v = ao * (1 + drift * 0.5);
    colors[i * 3]     = v;
    colors[i * 3 + 1] = v * (0.998 - 0.012 * (1 - ao));
    colors[i * 3 + 2] = v * (0.990 - 0.030 * (1 - ao));   // cavities dry warm
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function mergeParts(parts) {
  // simple merge: concatenate positions/normals/colors + reindex
  let vTotal = 0, iTotal = 0;
  for (const g of parts) { vTotal += g.attributes.position.count; iTotal += g.index.count; }
  const P = new Float32Array(vTotal * 3), N = new Float32Array(vTotal * 3), C = new Float32Array(vTotal * 3);
  const T = new Float32Array(vTotal * 2);
  const I = new Uint32Array(iTotal);
  let vo = 0, io = 0;
  for (const g of parts) {
    P.set(g.attributes.position.array, vo * 3);
    N.set(g.attributes.normal.array, vo * 3);
    C.set(g.attributes.color.array, vo * 3);
    if (g.attributes.uv) T.set(g.attributes.uv.array, vo * 2);
    const idx = g.index.array;
    for (let k = 0; k < idx.length; k++) I[io + k] = idx[k] + vo;
    vo += g.attributes.position.count; io += idx.length;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(T, 2));
  geo.setIndex(new THREE.BufferAttribute(I, 1));
  return geo;
}

console.log('carving…');
const detail = 1.0;

// the figure BODY is a watertight volume sculpted offline as a
// signed-distance field and meshed with Surface Nets
// (tools/sculpt-figure.mjs). It arrives with SDF-based AO already
// baked into COLOR_0 — we do not re-bake it.
function loadFigureBody() {
  const j = JSON.parse(readFileSync(`${REPO}/tools/.figure-hi.json`, 'utf8'));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(j.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(j.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(j.col, 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(j.tri), 1));
  g.computeBoundingSphere();
  return g;
}
const drapeGeo = loadFigureBody();

// the dominant near wing springs from the back/shoulder blades and
// sweeps DOWN across the front-left toward the base — the descending
// arc that carries the whole silhouette
// THE great wing: springs from the left shoulder, its leading edge
// sweeping UP to a peak (tip up-left), the vane cascading DOWN the
// left side of the pedestal — the iconic arc of the reference. It
// does not rest on the top; rest clamp off.
const wingFall = buildWing({
  span: 2.7, chord: 1.6, rise: 0.5, droop: 0.25,
  root: [-0.14, 2.52, -0.04], mirror: false, dive: 0.60, yaw: 2.88,
  seedO: 5, detail, folded: 0, rest: false,
});
// a short far wing folded low behind, barely seen
const wingLie = buildWing({
  span: 1.7, chord: 0.95, rise: 0.35, droop: 0.4,
  root: [0.12, 2.48, -0.28], mirror: false, dive: 0.5, yaw: 2.4,
  seedO: 9, detail: detail * 0.8, folded: 0.6, rest: false,
});
const hair = buildHair(detail);
const altar = buildAltar(detail);

console.log('baking…');
// (drapeGeo already carries SDF-baked AO — not re-baked)
const WOPT = { sphereScale: 0.35, floor: 0.52 };
bakeVertexColors(wingFall.vane, wingFall.vao, 631, null, WOPT);
wingFall.strips.forEach((s, i) => bakeVertexColors(s, wingFall.stripAOs[i], 631, null, WOPT));
bakeVertexColors(wingLie.vane, wingLie.vao, 641, null, WOPT);
wingLie.strips.forEach((s, i) => bakeVertexColors(s, wingLie.stripAOs[i], 641, null, WOPT));
bakeVertexColors(hair.geo, hair.ao, 173, null);
bakeVertexColors(altar.ped.geo, altar.ped.ao, 311, null);
bakeVertexColors(altar.slab.geo, altar.slab.ao, 313, null);
bakeVertexColors(altar.base.geo, altar.base.ao, 317, null);

const MESHES = [
  ['drape', drapeGeo],
  ['wingFall', wingFall.vane],
  ['wingFallTips', mergeParts(wingFall.strips)],
  ['wingLie', wingLie.vane],
  ['wingLieTips', mergeParts(wingLie.strips)],
  ['hair', hair.geo],
  ['pedestal', altar.ped.geo],
  ['slab', altar.slab.geo],
  ['base', altar.base.geo],
];

console.log('exporting…');
await MeshoptEncoder.ready;
await MeshoptSimplifier.ready;

async function writeGLB(path, ratio) {
  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene('monument');
  for (const [name, geo] of MESHES) {
    const prim = doc.createPrimitive();
    const mk = (arr, type, n) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
    prim.setAttribute('POSITION', mk(new Float32Array(geo.attributes.position.array), 'VEC3'));
    prim.setAttribute('NORMAL', mk(new Float32Array(geo.attributes.normal.array), 'VEC3'));
    prim.setAttribute('COLOR_0', mk(new Float32Array(geo.attributes.color.array), 'VEC3'));
    if (geo.attributes.uv) prim.setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2')
      .setArray(new Float32Array(geo.attributes.uv.array)).setBuffer(buf));
    const idx = geo.index.array;
    prim.setIndices(doc.createAccessor().setType('SCALAR')
      .setArray(idx instanceof Uint32Array ? idx : new Uint32Array(idx)).setBuffer(buf));
    const mesh = doc.createMesh(name).addPrimitive(prim);
    scene.addChild(doc.createNode(name).setMesh(mesh));
  }
  if (ratio < 1) await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.0008 }));
  await doc.transform(reorder({ encoder: MeshoptEncoder }), prune());
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const glb = await io.writeBinary(doc);
  const { writeFileSync } = await import('fs');
  writeFileSync(path, glb);
  let tris = 0;
  for (const [, geo] of MESHES) tris += geo.index.count / 3;
  console.log(path, Math.round(glb.byteLength / 1024) + ' KB', ratio === 1 ? Math.round(tris / 1000) + 'k tris (pre-simplify)' : '');
}

await writeGLB(`${REPO}/assets/models/monument.glb`, 0.55);   // ~440k tris, web hero
await writeGLB(`${REPO}/assets/models/monument-lo.glb`, 0.20);
console.log('done');
