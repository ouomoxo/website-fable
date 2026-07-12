// ═══════════════════════════════════════════════════════════════
// KLEOS — camera (free orbit)
// The monument is baked, so the visitor may look from anywhere.
// Scroll pulls the camera back as the light comes up; drag orbits;
// wheel/pinch dollies. Everything is damped, and it drifts on its
// own when left alone.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

export class OrbitCamera {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 300);
    this.pivot = new THREE.Vector3(0, 2.75, 0);
    this.az = 0.5; this.taz = 0.5;          // azimuth (drag)
    this.el = 0.10; this.tel = 0.10;        // elevation (drag)
    this.rad = 6.2; this.trad = 6.2;        // radius (scroll + wheel)
    this.idleV = 0.05;                       // gentle idle drift
    this.lastInput = -10;
  }

  // scroll drives the dolly: close and low in the dark → drawn back
  // for the whole temple in the glory
  setScroll(p) { this.trad = lerp(5.6, 8.8, p); this.baseEl = lerp(0.04, 0.20, p); }

  dragBy(dx, dy) {
    this.taz -= dx * 0.005;
    this.tel = clamp(this.tel - dy * 0.004, -0.15, 0.72);
    this.lastInput = this._t;
  }
  zoomBy(dz) { this.trad = clamp(this.trad + dz, 3.6, 12); this.lastInput = this._t; }

  update(t, dt) {
    this._t = t;
    // idle auto-drift when the user hasn't touched it for a moment
    if (t - this.lastInput > 2.2) this.taz += this.idleV * dt;
    // scroll's base elevation nudges the drag elevation gently
    if (this.baseEl != null) this.tel = lerp(this.tel, this.baseEl, 0.02);

    const k = 1 - Math.exp(-dt * 6);
    this.az = lerp(this.az, this.taz, k);
    this.el = lerp(this.el, this.tel, k);
    this.rad = lerp(this.rad, this.trad, 1 - Math.exp(-dt * 5));

    const ce = Math.cos(this.el), se = Math.sin(this.el);
    this.camera.position.set(
      this.pivot.x + Math.sin(this.az) * ce * this.rad,
      this.pivot.y + se * this.rad,
      this.pivot.z + Math.cos(this.az) * ce * this.rad
    );
    this.camera.lookAt(this.pivot);
  }
}
