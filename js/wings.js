// ═══════════════════════════════════════════════════════════════
// KATABASIS — wings
// Not feathers glued to a frame: a single carved surface, the way
// a sculptor would cut a wing from stone — scalloped rows reading
// as plumage, unfurling as one gesture.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

const SEG_U = 72;   // along the wing
const SEG_V = 14;   // across the chord

function smooth(t) { return t * t * (3 - 2 * t); }

class WingSurface {
  // one side, one layer
  constructor(side, layer, material) {
    this.side = side;                     // -1 left, +1 right
    this.layer = layer;                   // 0 primaries, 1 coverts
    this.geo = new THREE.PlaneGeometry(1, 1, SEG_U, SEG_V);
    const uv = this.geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 3.5, uv.getY(i) * 1.3);
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this._v3 = new THREE.Vector3();
  }

  // s ∈ [0,1] folded → open; scale = wing reach in metres
  deform(s, scale) {
    const side = this.side;
    const pos = this.geo.attributes.position;
    const e = smooth(s);
    const L = this.layer;

    // spine bezier control points, folded → open
    const p0 = [0, 0, 0];
    const rise = Math.pow(e, 0.72);           // wings lift early in the gesture
    const p1 = [
      lerp(0.5, 3.4, e) * side,
      lerp(-1.7, 4.6, rise),
      lerp(-0.28, -0.8, e),
    ];
    const p2 = [
      lerp(0.9, 9.8, e) * side,
      lerp(-4.4, 4.1, rise),
      lerp(-0.5, -2.6, e),
    ];

    const NF = L === 0 ? 9 : 14;              // scallop count (carved feather rows)
    const lenMul = (L === 0 ? 1 : 0.52) * (0.55 + 0.45 * e);
    const zLift = L === 0 ? 0 : 0.16;         // coverts sit slightly proud of the primaries

    let k = 0;
    for (let j = 0; j <= SEG_V; j++) {
      const v = j / SEG_V;
      for (let i = 0; i <= SEG_U; i++) {
        const u = i / SEG_U;

        // spine point
        const iu = 1 - u;
        const sx = iu * iu * p0[0] + 2 * iu * u * p1[0] + u * u * p2[0];
        const sy = iu * iu * p0[1] + 2 * iu * u * p1[1] + u * u * p2[1];
        const sz = iu * iu * p0[2] + 2 * iu * u * p1[2] + u * u * p2[2];

        // chord: feathers hang from the spine, rotating outward toward the tip
        const out = e * (0.18 + 0.85 * Math.pow(u, 1.35));
        let cx = out * side;
        let cy = -1;
        let cz = -0.10 - 0.28 * u * e;
        const cl = Math.hypot(cx, cy, cz);
        cx /= cl; cy /= cl; cz /= cl;

        // chord length: short at the shoulder, long primaries at the tip
        let chord = (0.34 + 0.30 * Math.sin(u * Math.PI * 0.75) + 0.55 * Math.pow(u, 1.7))
                    * 0.40 * scale * lenMul;

        // scalloped trailing edge — carved feather tips, notches cut inward
        const fIdx = Math.floor(u * NF);
        const wob = 0.85 + 0.3 * Math.abs(Math.sin(fIdx * 12.9898 + L * 4.7));
        const scallop = Math.pow(Math.abs(Math.sin(u * Math.PI * NF + L * 1.3)), 0.55);
        chord *= 1 + (scallop - 0.72) * 0.24 * wob * Math.pow(v, 3);

        // spine controls are authored for a 10 m wing; N rescales
        const N = scale / 10;
        const x = sx * N + cx * chord * v;
        const y = sy * N + cy * chord * v;
        const z = sz * N + cz * chord * v + zLift + Math.sin(v * Math.PI) * 0.10;

        pos.setXYZ(k++, x, y, z);
      }
    }
    pos.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

function lerp(a, b, t) { return a + (b - a) * t; }

// a single wing, frozen mid-gesture — the museum fragment
export function buildWingFragment(material, { scale = 8, spread = 0.78, side = 1 } = {}) {
  const group = new THREE.Group();
  for (const layer of [0, 1]) {
    const w = new WingSurface(side, layer, material);
    w.deform(spread, scale);
    group.add(w.mesh);
  }
  return group;
}

export class WingPair {
  constructor(material, scale = 10) {
    this.group = new THREE.Group();
    this.scale = scale;
    this.surfaces = [];
    for (const side of [-1, 1]) {
      for (const layer of [0, 1]) {
        const w = new WingSurface(side, layer, material);
        this.surfaces.push(w);
        this.group.add(w.mesh);
      }
    }
    this._spread = -1;
    this.setSpread(0);
  }

  setSpread(s) {
    s = Math.min(1, Math.max(0, s));
    if (Math.abs(s - this._spread) < 0.0008) return;
    this._spread = s;
    for (const w of this.surfaces) w.deform(s, this.scale);
  }
}
