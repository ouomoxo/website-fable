// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — camera
// Ten photographs of one unmoving angel, from too close to far
// enough. Every movement is mounted, slow, and ends in a composed
// frame. The withdrawal (S6) is the film's only long move.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// [t0, t1, pos0, pos1, look0, look1, fov0, fov1]
// Gaps between shots hold the previous composition.
// The whole film is seen from the monument's left — the side of
// the falling wing, the buried head, the hanging hand.
const SHOTS = [
  // S01 — stone before recognition: the wing's ribbed vane
  // straight on — fluting, nothing else
  [0.000, 0.060, [-2.52, 1.38, 2.30], [-2.54, 1.39, 2.22], [-2.62, 1.42, 0.60], [-2.62, 1.43, 0.60], 20, 20],
  // S02 — the colonnade betrays itself: the vane from above,
  // parallel ribs running to a scalloped edge
  [0.080, 0.200, [-2.35, 3.05, 2.70], [-2.28, 2.90, 2.55], [-2.66, 1.20, 0.55], [-2.62, 1.18, 0.58], 28, 26],
  // S03 — the drapery ravine: the head-end falls from below,
  // rising past the slab's cornice
  [0.240, 0.360, [-0.15, 0.92, 2.65], [-0.45, 1.00, 2.55], [-1.45, 1.75, 1.10], [-1.55, 1.72, 1.08], 24, 24],
  // S04 — the hanging hand (no text; the frame is enough)
  [0.400, 0.500, [-2.00, 1.00, 2.65], [-1.75, 1.08, 2.35], [-1.03, 1.35, 1.30], [-1.03, 1.32, 1.30], 26, 25],
  // S05 — the hidden face: from over the arm, the knot of hair
  // against the wing's wall — never features
  [0.540, 0.620, [0.15, 2.55, 1.95], [-0.05, 2.48, 1.90], [-1.35, 2.08, 0.38], [-1.38, 2.06, 0.40], 22, 22],
  // S06 — the labor: carved feather ends hanging against the
  // plain sawn face of the pedestal
  [0.660, 0.740, [-2.15, 0.90, 2.45], [-2.35, 0.95, 2.30], [-2.85, 1.25, 0.80], [-2.90, 1.20, 0.85], 24, 24],
  // S07 — the withdrawal: the only long move in the film
  [0.780, 0.920, [-1.38, 1.68, 2.10], [-6.80, 2.60, 8.60], [-0.95, 1.78, 0.95], [0.10, 1.70, 0], 26, 36],
  // S08 — the monument holds (0.92–0.955), then
  // S10 — distance: the weight remains
  [0.965, 1.000, [-6.80, 2.60, 8.60], [-10.20, 2.20, 12.60], [0.10, 1.70, 0], [0.30, 1.55, 0], 36, 40],
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

  // px, py ∈ [-1, 1]: minute optical deviation only. The camera is
  // mounted; nothing here may feel handheld.
  update(t, px, py, swayTime, swayAmp) {
    const fovBase = this._sample(t);

    const sx = Math.sin(swayTime * 0.14) * 0.045 * swayAmp;
    const sy = Math.sin(swayTime * 0.10) * 0.03 * swayAmp;

    this.camera.position.set(
      this._pos.x + sx + px * 0.05,
      this._pos.y + sy + py * -0.035,
      this._pos.z
    );
    this._look.x += px * 0.16;
    this._look.y += py * -0.1;
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
