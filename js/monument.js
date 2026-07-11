// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — the monument
// One unmoving angel, collapsed across an altar. Everything here
// is a single continuous sculpture: the drapery that reads as a
// ravine, the feathers that read as a colonnade, the hair against
// the folded arm, the one bare hand hanging over the edge.
// The angel never moves.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { fbmFactory } from './materials.js';

const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth01 = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const gauss = (x, c, w) => { const t = (x - c) / w; return Math.exp(-(t * t)); };

// ── shared: bake fold-cavity shading into vertex colors ────────
function addAO(geo, aoFn) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = clamp01(aoFn(i));
    colors[i * 3] = a; colors[i * 3 + 1] = a * 0.998; colors[i * 3 + 2] = a * 0.992;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

// ── the collapsed body: a figure kneeling BEHIND the altar,
// fallen forward across its top, everything under cloth ─────────
// World coordinates. u runs along the altar in x (u≈0.2 is the
// head end at -x); s sweeps the section from the ground behind
// (s = 0, -z) over the crest of the back to the hem hanging off
// the altar's front face (s = 1, +z).
export function buildBodyDrape({ seed = 7, detail = 1 } = {}) {
  const noise = fbmFactory(seed * 331 + 7, 4);
  const U = Math.round(160 * detail), V = Math.round(120 * detail);
  const geo = new THREE.PlaneGeometry(1, 1, U, V);
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count);

  const L = 3.75;                // length along the altar
  const TOP = 1.94;              // altar top (world y)

  // draped arm: shoulder → wrist, crossing the top to the front
  // edge where the bare hand hangs
  const AX0 = -0.72, AZ0 = 0.10, AX1 = -1.04, AZ1 = 1.02;
  const adx = AX1 - AX0, adz = AZ1 - AZ0;
  const alen2 = adx * adx + adz * adz;

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;            // 0..1 along the altar
    const s = 0.5 - pos.getY(i);            // 0 ground behind → 1 front hem
    const x = (u - 0.5) * L;

    // longitudinal profile: head mound, shoulder mass, the long
    // fall of the back, everything tapering at the trailing end
    const head      = 0.30 * gauss(u, 0.20, 0.12);
    const shoulders = 0.56 * gauss(u, 0.38, 0.17);
    const back      = 0.28 * gauss(u, 0.62, 0.22);
    const taper     = smooth01((u - 0.78) / 0.22);
    const endPinch0 = smooth01((u - 0.80) / 0.20);
    const crest = TOP + 0.08 * (1 - endPinch0) + 0.01
                + (head * 0.55 + shoulders + back) * (1 - 0.82 * taper) * (1 - endPinch0);

    // section control points (z, y)
    const kneel = 1.32 + 0.5 * gauss(u, 0.40, 0.30) * (1 - taper);  // ground reach behind
    // past the hips the back hem lifts out of the ground and the
    // cloth ends as a thin edge lying on the slab
    const endPinch = endPinch0;
    const zB = -kneel * (1 - endPinch) - 0.92 * endPinch;
    const yB = 0.03 * (1 - endPinch) + (TOP + 0.015) * endPinch;
    // the front hem hangs only where the body is; past the hips it
    // retreats onto the slab and the stone goes bare. The retreat
    // travels across the top first, then the fall begins — the hem
    // never floats off the corner.
    const hemDrop = 1 - smooth01((u - 0.40) / 0.22);
    const drop2 = smooth01((hemDrop - 0.45) / 0.40);
    // the spill deepens toward the head-end corner
    const yF0 = 1.30 - 0.22 * noise(u * 3.1, 7) - 0.45 * smooth01((-1.35 - x) / 0.55);
    const yF = 1.96 + (yF0 - 1.96) * drop2;
    const zF = (0.62 + 0.55 * hemDrop) * (1 - drop2) + 1.26 * drop2;
    const zC = -0.10 - 0.30 * (shoulders / 0.56);                    // crest drifts back over the body

    // quadratic bezier through the crest
    const p1y = 2 * crest - (yB + yF) / 2;
    const p1z = 2 * zC - (zB + zF) / 2;
    const a = (1 - s) * (1 - s), b = 2 * s * (1 - s), c = s * s;
    let z = a * zB + b * p1z + c * zF;
    let y = a * yB + b * p1y + c * yF;

    // the cloth lands against the stone, not inside it — blended
    // over the lip so the flow stays continuous
    {
      const k = smooth01((1.96 - y) / 0.22);
      if (s > 0.55) z = z + (Math.max(z, 1.22) - z) * k;   // spills over the front lip
      else if (s < 0.45) z = z + (Math.min(z, -1.14) - z) * k;
    }

    // folds: ridges running down the falls, quiet over the body,
    // easing in just below the lip so the silhouette stays clean
    const fallF = smooth01((s - 0.62) / 0.38);            // front fall
    const fallB = smooth01((0.30 - s) / 0.30);            // back fall
    const foldZone = Math.max(fallF, fallB) * smooth01((1.90 - y) / 0.25);
    const swirl = (noise(u * 2.0 + 9, s * 1.3) - 0.5) * 2.0;
    const ridge = Math.pow(0.5 + 0.5 * Math.sin(x * 15 + swirl + s * 1.6), 2.0);
    const dir = s < 0.45 ? -1 : 1;
    z += dir * 0.11 * foldZone * (ridge - 0.42) * (0.5 + 0.5 * noise(u * 1.7, 3.3));
    // secondary ripples and crinkle — the fold hierarchy that makes
    // close views read as carved cloth, not upholstery
    z += dir * 0.024 * foldZone * Math.sin(x * 42 + swirl * 2.2) * (0.4 + 0.6 * noise(u * 4.1, s * 2 + 5));
    z += dir * foldZone * (noise(u * 7 + 1, s * 5 + 3) - 0.5) * 0.05;

    // gathered cloth also pools where it meets the ground
    const pool = Math.max(smooth01((0.06 - s) / 0.06), 0);
    z -= pool * 0.10 * (0.4 + 0.6 * noise(u * 3.3, 11));

    // a narrow sleeve of cloth follows the wrist over the edge —
    // the bare hand continues below it
    z += gauss(x, -1.03, 0.10) * smooth01((s - 0.70) / 0.30) * hemDrop * 0.15;


    // the draped arm: a soft ridge crossing the altar top — only
    // where the cloth actually lies on the slab
    if (y > TOP + 0.01 && z > -0.4 && fallF < 0.35) {
      let t = ((x - AX0) * adx + (z - AZ0) * adz) / alen2;
      t = clamp01(t);
      const dxr = x - (AX0 + adx * t), dzr = z - (AZ0 + adz * t);
      const d2 = dxr * dxr + dzr * dzr;
      y += 0.16 * Math.exp(-d2 / (0.14 * 0.14)) * (0.85 + 0.3 * t);
      // the second arm, folded under the head
      const hx = x + 1.10, hz = z - 0.38;
      y += 0.13 * Math.exp(-(hx * hx / 0.32 + hz * hz / 0.10));
    }

    // tension wrinkles where the cloth stretches over the back
    if (y > TOP + 0.06) {
      const stretch = (1 - foldZone) * smooth01((y - TOP - 0.06) / 0.3);
      y += 0.013 * stretch * Math.sin(x * 9 + z * 5 + swirl * 1.5) * (0.4 + 0.6 * noise(x * 2.2, z * 2.2 + 4));
    }

    // fine cloth ripple — quiet at the lip so the silhouette
    // stays a clean stone edge
    const fineGate = 0.25 + 0.75 * smooth01((1.86 - y) / 0.22);
    const fine = (noise(u * 9 + 3, s * 7) - 0.5) * 0.015 * fineGate;
    y += fine; z += fine;

    pos.setXYZ(i, x, Math.max(y, 0.03), z);
    ao[i] = 1 - 0.32 * foldZone * (1 - ridge) - 0.10 * pool;
  }
  geo.computeVertexNormals();
  addAO(geo, (i) => ao[i]);
  geo.computeBoundingSphere();
  return geo;
}

// ── hair: the gathered knot at the crown — a coil, no poles ────
export function buildHair({ seed = 4, detail = 1 } = {}) {
  const noise = fbmFactory(seed * 173 + 1, 4);
  const geo = new THREE.TorusGeometry(0.60, 0.42, Math.round(44 * detail), Math.round(110 * detail));
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.y, v.x);                     // around the coil
    const cx = Math.cos(a) * 0.60, cy = Math.sin(a) * 0.60;
    const tx = v.x - cx, ty = v.y - cy;
    const radial = tx * Math.cos(a) + ty * Math.sin(a); // signed, outward
    const tb = Math.atan2(v.z, radial);                 // around the tube
    // strands wind slowly around the coil as they wrap the tube
    const wave = noise(a * 1.3 + 5, tb * 0.7) * 2.6;
    const strand = Math.pow(Math.abs(Math.sin(tb * 4.5 + a * 3.0 + wave)), 0.6);
    const fineS = Math.pow(Math.abs(Math.sin(tb * 13 + a * 6.5 + wave * 1.7)), 0.7);
    const clump = 0.5 + 0.5 * noise(a * 2.2 + 8, tb * 1.1);
    const rr = 1 - (0.06 + 0.09 * clump) * (1 - strand) - 0.022 * (1 - fineS);
    v.multiplyScalar(rr);
    pos.setXYZ(i, v.x, v.y, v.z * 0.66);                // squashed coil
    ao[i] = 1 - 0.20 * (1 - strand) - 0.10 * (1 - fineS) - 0.06 * (1 - clump);
  }
  geo.computeVertexNormals();
  addAO(geo, (i) => ao[i]);
  return geo;
}

// ── the wing: one carved vane, feathers radiating in relief ────
// As in the marble: not separate blades but a solid sheet whose
// long feathers fan from the shoulder toward the tip. It rises
// just past the head, then falls the way nothing alive falls —
// down across the altar's face, tip lowest. Built in world space:
// root position, yaw (sweep direction) and dive are applied here
// so the slab rest-clamp is exact.
export function buildWing({
  span = 3.1, chord = 1.45, rise = 0.55, droop = 1.55,
  root = [0, 2.5, 0], yaw = 0, dive = 0, mirror = false,
  seed = 5, detail = 1, folded = 0,
  slabY = 1.955, slabX = 2.10, slabZ = 1.20, rest = true,
} = {}) {
  const noise = fbmFactory(seed * 613 + 11, 4);
  const U = Math.round(150 * detail), W = Math.round(50 * detail);
  const geo = new THREE.PlaneGeometry(1, 1, U, W);
  const pos = geo.attributes.position;
  const ao = new Float32Array(pos.count);
  const nF = 15;
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cd = Math.cos(dive), sd = Math.sin(dive);

  for (let i = 0; i < pos.count; i++) {
    const u = pos.getX(i) + 0.5;                  // 0..1 along the sweep
    const w = pos.getY(i) + 0.5;                  // 0..1 down the vane

    // leading edge: up past the shoulder, then the long fall
    const lx = u * span;
    const ly = rise * Math.sin(Math.min(u * 2.2, 1) * Math.PI / 2)
             - droop * Math.pow(Math.max(0, u - 0.10) / 0.90, 1.55);
    const lz = (-0.14 + 0.18 * Math.sin(u * Math.PI)) * (1 - folded * 0.6);

    // vane depth: narrow at the root, widest past mid, pointed tip
    const cLen = chord
      * (0.24 + 0.72 * Math.sin(Math.min(u * 1.18, 1) * Math.PI * 0.64))
      * (1 - 0.62 * smooth01((u - 0.82) / 0.18))
      * (1 - 0.2 * folded);

    // feathers radiate from the root
    const ang = Math.atan2(w * 1.05, u + 0.06);
    const fi = ang / (Math.PI / 2) * nF;
    const r0 = fi - Math.floor(fi);
    const notch = Math.pow(0.5 + 0.5 * Math.cos((r0 - 0.5) * Math.PI * 2), 1.5);
    const notchCut = 0.09 * (1 - smooth01((u - 0.78) / 0.20));   // tip stays solid
    const cEff = w * (1 - notchCut * notch * smooth01((w - 0.70) / 0.30));

    // the vane hangs near vertical, cupped toward the body at the
    // root, opening flatter toward the tip
    const lean = 0.40 - 0.20 * u + 0.24 * cEff;
    const dy = -Math.cos(lean);
    const dz = Math.sin(lean) * (1 - folded * 0.5);

    let x = lx + (0.30 + 0.55 * u) * cEff * cLen * 0.45;  // trailing edge rakes tipward
    let y = ly + dy * cEff * cLen;
    let z = lz + dz * cEff * cLen;

    // carved relief: one rachis ridge per feather + banked rows
    const rise2 = smooth01((w - 0.16) / 0.30) * smooth01((u + w * 0.6 - 0.10) / 0.20);
    const ridge = gauss(r0, 0.5, 0.12);
    // the seam where one feather overlaps the next: a cut, not a dip
    const seam = smooth01((Math.abs(r0 - 0.5) - 0.34) / 0.14);
    const banks = 0.020 * (smooth01((w - 0.34) / 0.06) + smooth01((w - 0.64) / 0.06));
    const relief = (0.036 * (ridge - 0.30) - 0.016 * seam) * rise2 + banks;
    const grain = (noise(u * 6 + 3, w * 5) - 0.5) * 0.012 * rise2;
    y += Math.sin(lean) * (relief + grain);
    z += Math.cos(lean) * (relief + grain);

    // local → world: mirror, dive, then yaw, then root
    {
      if (mirror) x = -x;
      const x1 = x * cd - y * sd;
      const y1 = x * sd + y * cd;
      const x2 = x1 * cy + z * sy;
      const z2 = -x1 * sy + z * cy;
      x = x2 + root[0]; y = y1 + root[1]; z = z2 + root[2];
    }

    // where the vane crosses the altar it rests on the slab;
    // blended past the edges so the sheet folds over the corner
    // instead of tearing
    if (rest) {
      const rY = slabY + 0.012 * notch + relief;
      const t = smooth01((slabX + 0.22 - Math.abs(x)) / 0.44)
              * smooth01((slabZ + 0.22 - Math.abs(z)) / 0.44);
      if (y < rY && t > 0) y = y + (rY - y) * t;
    }
    y = Math.max(y, 0.04);

    pos.setXYZ(i, x, y, z);
    ao[i] = 1 - 0.20 * (1 - ridge) * rise2
              - 0.16 * seam * rise2
              - 0.10 * smooth01((0.22 - w) / 0.22)
              - 0.14 * notch * smooth01((w - 0.70) / 0.30);
  }
  geo.computeVertexNormals();
  addAO(geo, (i) => ao[i]);
  geo.computeBoundingSphere();
  return geo;
}

// ── the pedestal: a tapered altar with a molded cap ─────────────
export function buildPedestal({ wBot = 4.15, wTop = 3.7, dBot = 2.35, dTop = 2.0, h = 1.28 } = {}) {
  const geo = new THREE.BoxGeometry(1, 1, 1, 10, 5, 8);
  const pos = geo.attributes.position;
  const mix = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y + 0.5;
    pos.setXYZ(i, pos.getX(i) * mix(wBot, wTop, t), y * h, pos.getZ(i) * mix(dBot, dTop, t));
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

// ── rough-hewn base rock: intention meeting raw stone ──────────
export function buildRoughBase({ w = 4.6, h = 0.5, d = 3.0, seed = 3 } = {}) {
  const noise = fbmFactory(seed * 97 + 13, 4);
  const geo = new THREE.BoxGeometry(w, h, d, 44, 8, 30);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    // faceted chisel cuts, stronger below
    const cut = noise(v.x * 1.7 + 3, v.z * 1.7 - v.y);
    const facet = Math.round(cut * 5) / 5;             // stepped facets
    const amt = 0.10 * (0.4 + 0.6 * (0.5 - v.y / h));
    v.x += (facet - 0.5) * amt * Math.sign(v.x);
    v.z += (noise(v.z * 2.1, v.x * 1.3) - 0.5) * amt * Math.sign(v.z);
    if (v.y > h * 0.49) continue;                      // keep the top true
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}
