// ═══════════════════════════════════════════════════════════════
// KATABASIS — camera
// Not a tour: a sequence of composed photographs. Each shot moves
// once, slowly, then holds. Between shots the frame is still.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// [t0, t1, pos0, pos1, look0, look1, fov0, fov1]
// Gaps between shots hold the previous composition.
const SHOTS = [
  // I — the wall. A held exterior frame; barely breathing push-in.
  [0.000, 0.105, [0, 4.6, 41], [0, 4.4, 31], [0, 7.6, 0], [0, 6.8, 0], 38, 39],
  // approach the door
  [0.115, 0.205, [0, 4.4, 31], [0, 3.6, 10], [0, 6.8, 0], [0, 4.8, -4], 39, 41],
  // through the slit, into darkness
  [0.215, 0.275, [0, 3.6, 10], [0, 3.2, -3.5], [0, 4.8, -4], [0, -1.5, -20], 41, 42],
  // II — the stair, the blade of light crossing mid-frame
  [0.285, 0.410, [0, 2.0, -11], [0, -8.2, -41], [0, -2.5, -26], [0, -12.5, -58], 42, 42],
  // III — the veiled one appears, small, far, lit from her window
  [0.435, 0.545, [0, -8.6, -48], [-2.6, -9.0, -57.5], [4.5, -8.4, -72], [5, -8.2, -72], 37, 35],
  // approach — full figure, right of centre, air on the left
  [0.575, 0.660, [-2.6, -9.0, -57.5], [-0.6, -9.3, -62.5], [5, -8.2, -72], [5, -8.1, -72], 35, 34],
  // turn away, through the dark doorway
  [0.680, 0.760, [0.2, -9.6, -78], [0, -10.2, -96], [0, -10.8, -100], [-0.5, -10.2, -112], 36, 36],
  // IV — the wing: a slow lateral reveal under raking light
  [0.775, 0.855, [-3.6, -9.9, -99], [2.4, -10.2, -99.8], [-1.4, -9.2, -112], [-0.9, -9.0, -112], 35, 35],
  // descend toward the rotunda
  [0.865, 0.900, [0, -12.2, -122], [0, -14.8, -133], [0, -12.5, -140], [0, -9.5, -158], 38, 39],
  // V — the colossus, low angle, monumental
  [0.905, 0.960, [0, -16.3, -136], [0, -15.7, -143.5], [0, -9.5, -158], [0, -7.8, -158], 40, 42],
  // VI — anabasis: the camera rises; the gaze goes to the oculus
  [0.965, 1.000, [0, -15.7, -143.5], [0, -10.6, -145], [0, -7.8, -158], [0, 7.5, -158], 42, 45],
];

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t, out) => out.set(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 150);
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
        if (t < sh[0]) {                      // in the hold before this shot
          s = SHOTS[Math.max(0, i - 1)]; f = 1;
          break;
        }
        if (t <= sh[1]) {                     // inside this shot
          s = sh; f = smooth((t - sh[0]) / (sh[1] - sh[0]));
          break;
        }
        s = sh; f = 1;                        // past it — hold its end
      }
    }
    lerp3(s[2], s[3], f, this._pos);
    lerp3(s[4], s[5], f, this._look);
    return lerp(s[6], s[7], f);
  }

  // px, py ∈ [-1, 1] pointer parallax; sway = idle drift amount
  update(t, px, py, swayTime, swayAmp) {
    const fovBase = this._sample(t);

    // idle breath — the frame is handheld by something very calm
    const sx = (Math.sin(swayTime * 0.22) * 0.20 + Math.sin(swayTime * 0.10) * 0.12) * swayAmp;
    const sy = Math.sin(swayTime * 0.15) * 0.12 * swayAmp;

    this.camera.position.set(
      this._pos.x + sx + px * 0.45,
      this._pos.y + sy + py * -0.3,
      this._pos.z
    );
    this._look.x += px * 1.1;
    this._look.y += py * -0.7;
    // portrait screens: aim lower so the subject sits in the upper
    // frame and the copy owns the floor
    if (this.camera.aspect < 0.75) this._look.y -= 2.2;
    else if (this.camera.aspect < 1) this._look.y -= 0.9;
    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);

    // portrait screens get a wider eye so the monuments still fit
    const portrait = this.camera.aspect < 0.75 ? 13 : this.camera.aspect < 1 ? 7 : 0;
    const fov = fovBase + portrait;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
