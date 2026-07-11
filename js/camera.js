// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — camera
// Ten photographs of one unmoving angel, from too close to far
// enough. Every movement is mounted, slow, and ends in a composed
// frame. The withdrawal (S6) is the film's only long move.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// [t0, t1, pos0, pos1, look0, look1, fov0, fov1]
// Gaps between shots hold the previous composition. The whole film
// is seen LOW, looking up at a tall pedestal — the wing arcing to
// its peak, the buried head, the hand down the front face — after
// the reference. Every detail lives on the one unmoving monument.
const SHOTS = [
  // S01 — stone before meaning: the wing's feathered vane, close,
  // reading as fluted architecture
  [0.000, 0.060, [-0.10, 2.72, 1.55], [-0.16, 2.72, 1.50], [-0.95, 3.20, 0.15], [-0.98, 3.20, 0.14], 26, 26],
  // S02 — the colonnade betrays itself: sliding down the vane until
  // the feather tips resolve
  [0.080, 0.200, [0.15, 2.52, 1.85], [-0.28, 2.66, 1.52], [-0.85, 3.05, 0.10], [-1.05, 3.28, 0.02], 30, 29],
  // S03 — the drapery ravine: the garment falling down the left side
  [0.240, 0.360, [-1.55, 1.62, 1.55], [-1.78, 1.42, 1.32], [-0.92, 1.65, 0.05], [-0.96, 1.55, 0.02], 30, 30],
  // S04 — the hanging hand down the front face (no text; enough)
  [0.400, 0.500, [1.95, 1.55, 2.05], [1.72, 1.48, 1.92], [0.66, 1.52, 0.92], [0.66, 1.50, 0.92], 30, 29],
  // S05 — the hidden face: hair and the cradling arm, from above-right
  [0.540, 0.620, [2.25, 2.70, 2.15], [2.02, 2.60, 2.05], [0.46, 2.52, 0.46], [0.47, 2.50, 0.47], 30, 29],
  // S06 — the labor: the pedestal's molded cornice meeting the raw base
  [0.660, 0.740, [2.55, 1.35, 2.45], [2.35, 1.35, 2.28], [0.85, 1.95, 0.70], [0.82, 1.98, 0.66], 30, 30],
  // S07 — the withdrawal: the only long move — a mid detail opens to
  // the whole monument, low and rising slightly
  [0.780, 0.920, [1.65, 1.62, 2.75], [5.60, 1.55, 6.65], [0.20, 2.15, 0.20], [0.12, 2.12, 0.10], 30, 42],
  // S08 — the monument holds (0.92–0.965), then
  // S10 — distance: the weight remains
  [0.965, 1.000, [5.60, 1.55, 6.65], [7.85, 1.75, 9.05], [0.12, 2.12, 0.10], [0.16, 2.02, 0.06], 42, 44],
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
