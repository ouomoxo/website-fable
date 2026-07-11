// ═══════════════════════════════════════════════════════════════
// KLEOS — camera
// Eight photographs of one unmoving Victory, from too close to far
// enough. Every movement is mounted, slow, and ends in a composed
// frame. The withdrawal (S7) is the film's only long move.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// [t0, t1, pos0, pos1, look0, look1, fov0, fov1]
// Gaps between shots hold the previous composition. The whole film
// is seen LOW, looking up at a tall pedestal — the epic seen from
// beneath. Every detail lives on the one unmoving monument.
// Anchored to the standing winged Victory (Stanford "Lucy",
// original pose): head near [0.1, 4.15, 0.15], the torch lifted in
// the right hand ~[0.38, 4.15, 0.30], wings spread to [±0.58, 4.17,
// -0.15], the gown falling to the cap at y≈2.24, the classical
// pedestal dropping to the ground. She faces +Z; every camera reads
// her from the front, low, looking up — the epic seen from beneath.
const SHOTS = [
  // S01 — stone before the name: a wing's vane, close, abstract
  [0.000, 0.060, [0.78, 3.52, 1.38], [0.70, 3.60, 1.28], [0.34, 3.98, 0.06], [0.34, 4.03, 0.04], 26, 26],
  // S02 — the wings open: pulling back until both spread over her
  [0.080, 0.200, [0.52, 3.50, 1.60], [-0.02, 3.72, 1.78], [0.30, 4.00, 0.05], [0.06, 4.06, 0.06], 30, 30],
  // S03 — the gown: the drapery falling from the waist
  [0.240, 0.360, [-1.24, 2.92, 1.52], [-1.40, 2.72, 1.36], [-0.34, 3.08, 0.30], [-0.40, 2.92, 0.28], 30, 30],
  // S04 — the flame lifted: the torch raised in the right hand
  [0.400, 0.500, [1.18, 3.52, 1.72], [1.02, 3.58, 1.60], [0.36, 4.10, 0.28], [0.35, 4.12, 0.28], 30, 29],
  // S05 — the face turned up: resolute, unbroken
  [0.540, 0.620, [0.58, 3.74, 1.78], [0.44, 3.80, 1.66], [0.12, 4.08, 0.18], [0.10, 4.10, 0.18], 30, 29],
  // S06 — the labor: the pedestal's cornice and the stone below
  [0.660, 0.740, [1.52, 1.34, 2.02], [1.36, 1.26, 1.90], [0.24, 2.18, 0.62], [0.18, 2.06, 0.56], 30, 30],
  // S07 — the withdrawal: the only long move — a detail opens to the
  // whole figure seen frontal and low, wings against the dark
  [0.780, 0.920, [0.95, 1.75, 2.65], [1.55, 2.35, 7.70], [0.05, 3.05, 0.20], [0.00, 3.00, 0.10], 30, 42],
  // S08 — she holds (0.92–0.965), then distance: the glory remains,
  // drifting to the right of frame for the closing text
  [0.965, 1.000, [1.55, 2.35, 7.70], [1.05, 2.55, 9.90], [0.00, 3.00, 0.10], [-1.55, 2.95, 0.05], 42, 44],
];

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t, out) => out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(24, aspect, 0.05, 120);
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  _sample(t) {
    let s = SHOTS[0], f = 0;
    if (t <= SHOTS[0][0]) {
      s = SHOTS[0]; f = 0;
    } else if (t >= SHOTS[SHOTS.length - 1][1]) {
      s = SHOTS[SHOTS.length - 1]; f = 1;
    } else {
      for (let i = 0; i < SHOTS.length; i++) {
        const sh = SHOTS[i];
        if (t < sh[0]) { s = SHOTS[Math.max(0, i - 1)]; f = 1; break; }
        if (t <= sh[1]) { s = sh; f = smooth((t - sh[0]) / (sh[1] - sh[0])); break; }
        s = sh; f = 1;
      }
    }
    lerp3(s[2], s[3], f, this._pos);
    lerp3(s[4], s[5], f, this._look);
    return lerp(s[6], s[7], f);
  }

  // The camera is mounted. No sway, no pointer response, no
  // handheld noise — the dolly is exact or it is nothing.
  update(t) {
    const fovBase = this._sample(t);

    this.camera.position.copy(this._pos);
    // portrait: aim a touch lower so the monument sits high and
    // the copy owns the ground
    if (this.camera.aspect < 0.75) this._look.y -= 0.34;
    else if (this.camera.aspect < 1) this._look.y -= 0.16;
    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);

    const portrait = this.camera.aspect < 0.75 ? 9 : this.camera.aspect < 1 ? 5 : 0;
    const fov = fovBase + portrait;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
