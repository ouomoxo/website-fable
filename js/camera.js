// ═══════════════════════════════════════════════════════════════
// KATABASIS — camera
// One continuous shot, thirty storeys long. Scroll is the dolly.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// keyframes: [t, position, lookAt, fov]
const KEYS = [
  [0.000, [0, 3.1, 23.5],    [0, 6.6, 0],       55],
  [0.055, [0, 3.4, 10.5],    [0, 0.6, -12],     55],
  [0.110, [0, 0.8, -2.5],    [0, -4.6, -24],    57],
  [0.140, [0, -1.8, -9.0],   [0, -6.0, -30],    58],
  [0.175, [2.2, -3.2, -20],  [-1.5, -4.8, -44], 60],
  [0.240, [-2.2, -3.8, -40], [1.5, -5.5, -62],  60],
  [0.300, [0, -3.6, -57],    [0, -8.5, -76],    58],
  [0.330, [0, -5.0, -66.5],  [0, -10.5, -95],   57],
  [0.360, [0, -9.2, -75.5],  [0, -10.3, -92],   56],
  [0.415, [2.6, -10.2, -87], [-6, -9.6, -92.5], 54],
  [0.475, [-2.6, -10.6, -98],[6, -9.8, -103.5], 54],
  [0.535, [2.0, -10.8, -110],[0, -9.9, -117.5], 52],
  [0.590, [0, -10.8, -119.5],[0, -15.0, -138],  56],
  [0.618, [0, -12.6, -126.5],[0, -17.5, -144],  57],
  [0.645, [0, -16.4, -135.5],[0, -19.3, -152],  58],
  [0.700, [2.6, -17.6, -152],[-2.5, -19.8, -166], 58],
  [0.755, [0, -18.4, -176],  [0, -19.5, -194],  56],
  [0.800, [0, -22.0, -189],  [0, -15.0, -214],  54],
  [0.860, [-9.0, -19.0, -195],[0, -13.5, -214], 52],
  [0.910, [6.5, -16.0, -197.5],[0, -12.0, -214], 50],
  [0.950, [0, -12.5, -199.5],[0, -9.5, -214.5], 48],
  [0.975, [0, -3.0, -210],   [0, 14.0, -214],   52],
  [1.000, [0, 15.0, -213.2], [0, 44.0, -214],   60],
];

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 140);
    this.posCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k[1])), false, 'centripetal', 0.5);
    this.lookCurve = new THREE.CatmullRomCurve3(KEYS.map(k => new THREE.Vector3(...k[2])), false, 'centripetal', 0.5);
    this.times = KEYS.map(k => k[0]);
    this.fovs = KEYS.map(k => k[3]);
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._sway = new THREE.Vector3();
    this._up = new THREE.Vector3(0, 1, 0);
  }

  // progress t → curve parameter u (keyframes are non-uniform in t)
  _param(t) {
    const times = this.times;
    const n = times.length - 1;
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    for (let i = 1; i <= n; i++) {
      if (t <= times[i]) {
        const f = (t - times[i - 1]) / (times[i] - times[i - 1]);
        return (i - 1 + f) / n;
      }
    }
    return 1;
  }

  _fov(t) {
    const times = this.times;
    for (let i = 1; i < times.length; i++) {
      if (t <= times[i]) {
        const f = (t - times[i - 1]) / (times[i] - times[i - 1]);
        return this.fovs[i - 1] + (this.fovs[i] - this.fovs[i - 1]) * f;
      }
    }
    return this.fovs[this.fovs.length - 1];
  }

  // px, py ∈ [-1, 1] pointer parallax; sway = idle drift amount
  update(t, px, py, swayTime, swayAmp) {
    const u = this._param(t);
    this.posCurve.getPoint(u, this._pos);
    this.lookCurve.getPoint(u, this._look);

    // idle breath — the shot is handheld by something very calm
    this._sway.set(
      Math.sin(swayTime * 0.24) * 0.32 + Math.sin(swayTime * 0.11) * 0.18,
      Math.sin(swayTime * 0.17) * 0.2,
      0
    ).multiplyScalar(swayAmp);

    // pointer parallax — look around without leaving the path
    const off = this._sway;
    this.camera.position.set(
      this._pos.x + off.x + px * 0.7,
      this._pos.y + off.y + py * -0.45,
      this._pos.z
    );
    this._look.x += px * 1.6;
    this._look.y += py * -1.0;
    this.camera.up.copy(this._up);
    this.camera.lookAt(this._look);

    // portrait screens get a wider eye so the monuments still fit the frame
    const portrait = this.camera.aspect < 0.75 ? 14 : this.camera.aspect < 1 ? 7 : 0;
    const fov = this._fov(t) + portrait;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }

  get depthMeters() {
    return Math.max(0, -this.camera.position.y);
  }
}
