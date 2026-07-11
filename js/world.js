// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — world
// One place, one monument, one unmoving angel. The visitor moves;
// the light moves; the sculpture does not. Coordinates are metres;
// the monument's rough base rests on the ground at y = 0.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { scaleUV } from './builders.js';
import { loadSculptures } from './assets.js';
import { buildBodyDrape, buildHair, buildWing, buildRoughBase, buildPedestal } from './monument.js';

const V3 = THREE.Vector3;
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0908);
    this.scene.fog = new THREE.FogExp2(0x0b0a08, 0.012);
    this.time = 0;
    this.buildSteps = [];
    this._plan();
  }

  _plan() {
    this.buildSteps = [
      (onProgress) => loadSculptures(this.quality.assetTier, onProgress)
        .then((models) => { this.models = models; }),
      () => { this.materials = createMaterials(this.renderer, this.quality); },
      () => this._buildGround(),
      () => this._buildMonument(),
      () => this._buildLight(),
    ];
  }

  _box(w, h, d, x, y, z, mat, parent, { ry = 0, cast = false, uv = null } = {}) {
    let geo = new THREE.BoxGeometry(w, h, d);
    if (uv) geo = scaleUV(geo, uv[0], uv[1]);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ── the place: ground and a masonry recess behind ────────────

  _buildGround() {
    const { floor, wall } = this.materials;
    const g = new THREE.Group();
    this.scene.add(g);

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floor);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);

    // the niche: a heavy wall behind the monument, side returns,
    // everything dissolving upward into dark
    this._box(30, 15, 1.6, 0, 7.5, -4.4, wall, g, { uv: [5, 2.8] });
    this._box(1.6, 15, 9, -11.5, 7.5, -0.2, wall, g, { uv: [1.6, 2.8] });
    this._box(1.6, 15, 9, 11.5, 7.5, -0.2, wall, g, { uv: [1.6, 2.8] });
    // a low bench of stone either side — scale, not decoration
    this._box(3.6, 0.55, 1.1, -6.4, 0.275, -3.4, wall, g, { uv: [1.4, 0.3] });
    this._box(3.6, 0.55, 1.1, 6.2, 0.275, -3.3, wall, g, { uv: [1.4, 0.3] });
  }

  // ── the monument ─────────────────────────────────────────────

  _buildMonument() {
    const { marble, scan, scanPlain, feather, stone } = this.materials;
    const g = this.monument = new THREE.Group();
    this.scene.add(g);
    const detail = this.quality.detail;

    // the figure's stone — one carrara for drape, hair, wings, hand
    const carrara = scan;

    // rough-hewn base: raw block under intended form
    const base = new THREE.Mesh(buildRoughBase({ w: 4.9, h: 0.52, d: 3.15, seed: 3 }), stone);
    base.position.set(0, 0.26, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    g.add(base);

    // the altar: a tapered pedestal, molded cap, wide slab.
    // slab top lands at y = 1.94 — the drape is built against it.
    const ped = new THREE.Mesh(buildPedestal({ wBot: 4.15, wTop: 3.66, dBot: 2.35, dTop: 1.98, h: 1.28 }), marble);
    ped.position.set(0, 0.52 + 0.64, 0);
    ped.castShadow = true;
    ped.receiveShadow = true;
    g.add(ped);
    this._box(3.90, 0.08, 2.22, 0, 1.84, 0, marble, g, { cast: true, uv: [1.6, 0.08] });
    this._box(4.15, 0.12, 2.40, 0, 1.88, 0, marble, g, { cast: true, uv: [1.7, 0.1] });

    // the collapsed body — cloth over everything, built in world
    // coordinates (kneels behind the altar, falls across its top)
    const drape = new THREE.Mesh(buildBodyDrape({ seed: 7, detail }), carrara);
    drape.name = 'drape';
    drape.castShadow = true;
    drape.receiveShadow = true;
    g.add(drape);

    // hair, face turned down and away — never shown
    const hair = new THREE.Mesh(buildHair({ seed: 4, detail }), carrara);
    hair.scale.setScalar(0.27);
    hair.position.set(-1.28, 2.10, 0.44);
    hair.rotation.set(-1.25, 0.15, 0.20);
    hair.name = 'hair';
    hair.castShadow = true;
    hair.receiveShadow = true;
    g.add(hair);

    // the one bare thing: the hand, released below the hem's edge —
    // the wrist disappears up into the hanging cloth
    const hand = new THREE.Mesh(this.models.hand, scanPlain);
    hand.scale.setScalar(0.70);
    hand.position.set(-1.03, 1.22, 1.40);
    hand.rotation.set(-0.35, 0.95, 0.06);
    hand.name = 'hand';
    hand.castShadow = true;
    hand.receiveShadow = true;
    g.add(hand);

    // wings — collapsed, not spread. Both root at the shoulder
    // blades near the crest. The falling wing rises just past the
    // head then dives past the altar's end into the clear — tip
    // lowest thing in the silhouette, the way nothing alive falls.
    const wingFall = new THREE.Mesh(buildWing({
      span: 2.55, chord: 1.45, rise: 0.6, droop: 1.15,
      root: [-0.68, 2.60, -0.12], mirror: true, dive: 0.22, yaw: 0.30,
      seed: 5, detail, folded: 0,
    }), feather);
    wingFall.name = 'wingFall';
    wingFall.castShadow = true;
    wingFall.receiveShadow = true;
    g.add(wingFall);

    // the other wing lies along the body toward the foot end,
    // resting on the stone where it crosses the slab
    const wingLie = new THREE.Mesh(buildWing({
      span: 2.8, chord: 1.15, rise: 0.42, droop: 1.05,
      root: [-0.50, 2.40, -0.55], yaw: -0.22, dive: -0.08,
      seed: 9, detail: detail * 0.85, folded: 0.40,
    }), feather);
    wingLie.name = 'wingLie';
    wingLie.castShadow = true;
    wingLie.receiveShadow = true;
    g.add(wingLie);
  }

  // ── light: one day, slowly turning late ──────────────────────

  _buildLight() {
    // key: soft daylight from high front-left, out of frame
    const key = new THREE.DirectionalLight(0xf2ebdc, 2.2);
    key.position.set(-6.5, 10, 10.5);
    key.target.position.set(0, 1.6, 0);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -7; key.shadow.camera.right = 7;
      key.shadow.camera.top = 8; key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 2; key.shadow.camera.far = 40;
      key.shadow.bias = -0.0012;
      key.shadow.normalBias = 0.05;
    }
    this.scene.add(key, key.target);
    this.key = key;

    // sky and ground return
    this.hemi = new THREE.HemisphereLight(0x504f4b, 0x14110e, 0.58);
    this.scene.add(this.hemi);

    // warm bounce off the pavement in front — directional so it
    // never draws a pool of light on the ground
    this.bounce = new THREE.DirectionalLight(0xcdbfa4, 0.5);
    this.bounce.position.set(2.5, 1.2, 9);
    this.bounce.target.position.set(-0.5, 1.8, 0);
    this.scene.add(this.bounce, this.bounce.target);

    // faint cool separation from behind the niche edge — it also
    // rakes the kneeling falls in the opening frames
    const rim = new THREE.DirectionalLight(0x7d7a72, 0.75);
    rim.position.set(6, 4, -7);
    rim.target.position.set(-0.5, 2, 0);
    this.scene.add(rim, rim.target);
    this.rim = rim;
  }

  // ── per-frame: the day turns; nothing else moves ─────────────

  update(progress) {
    if (!this.key) return;
    // movement V: the light lowers and cools; the posture endures
    const late = ss(progress, 0.93, 0.995);
    this.key.intensity = lerp(2.2, 1.35, late);
    this.key.color.setRGB(
      lerp(0.941, 0.83, late),
      lerp(0.906, 0.80, late),
      lerp(0.831, 0.79, late)
    );
    this.key.position.set(lerp(-6.5, -11, late), lerp(10, 5.5, late), lerp(10.5, 6.5, late));
    this.hemi.intensity = lerp(0.58, 0.36, late);
    this.bounce.intensity = lerp(0.5, 0.22, late);
    this.rim.intensity = lerp(0.5, 0.72, late);
    this.scene.fog.density = lerp(0.012, 0.017, late);
  }
}
