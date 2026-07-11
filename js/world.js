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
    const { marble, marbleV, scan, scanPlain, feather, stoneV } = this.materials;
    const g = this.monument = new THREE.Group();
    this.scene.add(g);

    // the monument arrives fully carved and AO-baked (offline
    // pipeline: tools/bake-monument.mjs). Assign stone by name.
    const parts = this.models.monument;
    const MAT = {
      drape: scan, hair: scan,
      wingFall: feather, wingLie: feather,
      wingFallTips: feather, wingLieTips: feather,
      pedestal: marbleV, slab: marbleV,
      base: stoneV,
    };
    for (const [name, geo] of Object.entries(parts)) {
      const m = new THREE.Mesh(geo, MAT[name] || scan);
      m.name = name;
      // separated feather tips carry baked shading only — dynamic
      // shadow maps would zebra the slots between them
      const isTips = name.endsWith('Tips');
      m.castShadow = !isTips;
      m.receiveShadow = !isTips;
      g.add(m);
    }

    // the one bare thing: the hand, released below the hem's edge —
    // the wrist disappears up into the hanging cloth
    const hand = new THREE.Mesh(this.models.hand, scanPlain);
    hand.scale.setScalar(0.60);
    hand.position.set(0.66, 1.66, 0.98);
    hand.rotation.set(-0.22, 0.55, 0.10);
    hand.name = 'hand';
    hand.castShadow = true;
    hand.receiveShadow = true;
    g.add(hand);

    // soft contact ambience under the whole monument — a computed
    // decal so the mass sits in the ground, not on it
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(7.4, 5.2),
      new THREE.MeshBasicMaterial({
        map: makeContactShadowTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.MultiplyBlending,
      })
    );
    decal.rotation.x = -Math.PI / 2;
    decal.position.set(0, 0.012, 0.1);
    decal.renderOrder = 1;
    g.add(decal);
  }

  // ── light: one day, slowly turning late ──────────────────────

  _buildLight() {
    // key: soft daylight from high front-left, out of frame
    const key = new THREE.DirectionalLight(0xf2ebdc, 2.2);
    key.position.set(-6.5, 10, 10.5);
    key.target.position.set(0, 1.6, 0);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      const ss = this.quality.shadowSize || 2048;
      key.shadow.mapSize.set(ss, ss);
      key.shadow.camera.left = -7; key.shadow.camera.right = 7;
      key.shadow.camera.top = 8; key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 2; key.shadow.camera.far = 40;
      key.shadow.bias = -0.0012;
      key.shadow.normalBias = 0.05;
    }
    this.scene.add(key, key.target);
    this.key = key;

    // sky and ground return
    this.hemi = new THREE.HemisphereLight(0x504f4b, 0x1a1613, 0.62);
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
    this.hemi.intensity = lerp(0.62, 0.38, late);
    this.bounce.intensity = lerp(0.5, 0.22, late);
    this.rim.intensity = lerp(0.5, 0.72, late);
    this.scene.fog.density = lerp(0.012, 0.017, late);
  }
}

// soft multiply-decal for ground contact — precomputed, static
function makeContactShadowTexture() {
  const S = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, S, S);
  const grad = ctx.createRadialGradient(S / 2, S / 2, S * 0.12, S / 2, S / 2, S * 0.5);
  grad.addColorStop(0, 'rgba(30,26,22,0.55)');
  grad.addColorStop(0.55, 'rgba(30,26,22,0.28)');
  grad.addColorStop(1, 'rgba(30,26,22,0)');
  ctx.save();
  ctx.translate(S / 2, S / 2);
  ctx.scale(1, 0.72);
  ctx.translate(-S / 2, -S / 2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  ctx.restore();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}
