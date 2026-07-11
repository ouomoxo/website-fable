// ═══════════════════════════════════════════════════════════════
// KLEOS — world
// one place, one monument, one unmoving Victory. The visitor moves;
// the light moves; the sculpture does not. Coordinates are metres;
// the monument's rough base rests on the ground at y = 0.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { createMaterials, fbmFactory } from './materials.js';
import { loadSculptures } from './assets.js';

const V3 = THREE.Vector3;
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    // a cool near-black — marble against night, not mud
    this.scene.background = new THREE.Color(0x070809);
    this.scene.fog = new THREE.FogExp2(0x090b0e, 0.030);
    this.time = 0;
    this.buildSteps = [];
    this._plan();
  }

  _plan() {
    this.buildSteps = [
      (onProgress) => loadSculptures(this.quality.assetTier, onProgress)
        .then((models) => { this.models = models; }),
      () => { this.materials = createMaterials(this.renderer, this.quality); this._setMaterials(); },
      () => this._buildTemple(),
      () => this._buildColonnade(),
      () => this._buildMonument(),
      () => this._buildLight(),
    ];
  }

  _setMaterials() {
    const env = this.materials.env;
    // cool temple marble for the architecture — colder and cleaner
    // than the figure's warmer, hand-scanned stone
    this.mMarble = new THREE.MeshStandardMaterial({
      color: 0xc9c4bb, roughness: 0.58, metalness: 0.0,
      envMap: env, envMapIntensity: 0.22,
    });
    // weathered, darker stone for the broken fragments on the ground
    this.mFrag = new THREE.MeshStandardMaterial({
      color: 0x8f887b, roughness: 0.86, metalness: 0.0,
      envMap: env, envMapIntensity: 0.10,
    });
    // the flame: emissive, unlit-bright
    this.mFlame = new THREE.MeshBasicMaterial({ color: 0xffb257, fog: false });
  }

  _box(w, h, d, x, y, z, mat, parent, { ry = 0, cast = false } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  // ── the place: a sanctuary floor, steps at the approach ───────

  _buildTemple() {
    const { floor } = this.materials;
    floor.color.setHex(0x6d675c);
    const g = this.temple = new THREE.Group();
    this.scene.add(g);

    // the sanctuary floor the monument and columns stand on
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), floor);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    g.add(ground);

    // three steps descending at the approach (+Z), a stylobate edge
    const stepMat = this.mMarble;
    for (let i = 0; i < 3; i++) {
      const z = 5.8 + i * 0.72;
      this._box(15.5 - i * 0.4, 0.24, 0.72, 0, -0.12 - i * 0.24, z, stepMat, g);
    }
    // a lower forecourt beyond the steps, so the steps read as a drop
    const court = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), floor);
    court.rotation.x = -Math.PI / 2;
    court.position.set(0, -0.72, 38);
    court.receiveShadow = true;
    g.add(court);
  }

  // ── the colonnade: two rows receding into fog + architrave ────

  _buildColonnade() {
    const set = this.models.set;
    const colGeo = set.column;
    const ROWS = [-3.75, 3.75];
    const ZS = [3.4, -0.9, -5.2, -9.5, -13.8];
    const inst = new THREE.InstancedMesh(colGeo, this.mMarble, ROWS.length * ZS.length);
    inst.castShadow = true; inst.receiveShadow = true;
    const m = new THREE.Matrix4(); const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1); const p = new THREE.Vector3();
    let n = 0;
    for (const x of ROWS) {
      for (const z of ZS) {
        // tiny per-column yaw so the fluting never twins exactly
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (n % 3 - 1) * 0.04);
        p.set(x, 0, z);
        m.compose(p, q, s);
        inst.setMatrixAt(n++, m);
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    this.scene.add(inst);

    // architrave: a long beam capping each row, so the key rakes
    // bars of shadow down the floor
    const zA = (ZS[0] + ZS[ZS.length - 1]) / 2;
    const dZ = Math.abs(ZS[0] - ZS[ZS.length - 1]) + 1.4;
    for (const x of ROWS) {
      this._box(1.0, 0.72, dZ, x, 5.16, zA, this.mMarble, this.scene, { cast: true });
    }

    // fallen fragments — the ruin, the time that has passed
    const frag = (geo, x, z, rx, ry, rz, sc = 1) => {
      const me = new THREE.Mesh(geo, this.mFrag);
      me.position.set(x, 0, z); me.rotation.set(rx, ry, rz);
      me.scale.setScalar(sc);
      me.castShadow = true; me.receiveShadow = true;
      this.scene.add(me);
    };
    frag(set.drum, -2.3, 3.1, Math.PI / 2, 0.4, 0, 1);        // rolled to rest
    frag(set.drum, 3.0, -2.2, Math.PI / 2, -0.7, 0.1, 0.92);
    frag(set.capital_fallen, 2.35, 3.7, 0, 0.6, 0, 0.95);     // toppled capital
    frag(set.drum, -3.4, -6.6, Math.PI / 2, 1.2, 0, 0.85);
  }

  // ── the monument + the altar flame ───────────────────────────

  _buildMonument() {
    const { scan } = this.materials;
    const g = this.monument = new THREE.Group();
    // the figure's face and torch are carved toward -Z in the source;
    // turn her to face the visitor at +Z
    g.rotation.y = Math.PI;
    this.scene.add(g);

    const parts = this.models.monument;
    const figureGeo = parts.figure;
    const pedestalGeo = parts.pedestal;

    // the figure carries no UVs — its tonal life is baked as vertex
    // colour: quiet mineral drift, cooler and heavier down low
    veinFigure(figureGeo);
    const figMat = scan.clone();
    figMat.color.setHex(0xc3bbad);
    const figure = new THREE.Mesh(figureGeo, figMat);
    figure.name = 'figure';
    figure.castShadow = true; figure.receiveShadow = true;
    g.add(figure);

    const pedMat = this.mMarble.clone();
    pedMat.color.setHex(0xb7b1a6);
    const pedestal = new THREE.Mesh(pedestalGeo, pedMat);
    pedestal.name = 'pedestal';
    pedestal.castShadow = true; pedestal.receiveShadow = true;
    g.add(pedestal);

    // the altar before her, and its small unquenched flame — the
    // fire the poem keeps burning
    const altar = new THREE.Mesh(this.models.set.altar, this.mMarble);
    altar.position.set(-1.75, 0, 2.5);
    altar.castShadow = true; altar.receiveShadow = true;
    this.scene.add(altar);

    // a small bright core plus a soft additive glow — reads as fire,
    // not geometry
    const core = this.flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 10, 8), this.mFlame
    );
    core.position.set(-1.75, 1.05, 2.5);
    core.renderOrder = 2;
    this.scene.add(core);

    const glow = this.flameGlow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffa64a,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    glow.position.copy(core.position);
    glow.scale.set(1.15, 1.15, 1);
    glow.renderOrder = 2;
    this.scene.add(glow);
  }

  // ── light: a cold hall, one warm shaft, one flame ────────────

  _buildLight() {
    // key: a single hard shaft from high front-left — the god-ray
    const key = new THREE.DirectionalLight(0xfff1d8, 3.0);
    key.position.set(-5.5, 15, 8.5);
    key.target.position.set(0, 2.6, 0);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      const sz = this.quality.shadowSize || 2048;
      key.shadow.mapSize.set(sz, sz);
      key.shadow.camera.left = -10; key.shadow.camera.right = 10;
      key.shadow.camera.top = 10; key.shadow.camera.bottom = -3;
      key.shadow.camera.near = 2; key.shadow.camera.far = 46;
      key.shadow.bias = -0.0011;
      key.shadow.normalBias = 0.045;
    }
    this.scene.add(key, key.target);
    this.key = key;

    // cool sky / warm ground: marble shadows drift blue, so the warm
    // key reads as sun and the hall stays cold
    this.hemi = new THREE.HemisphereLight(0x3a4a63, 0x120d0a, 0.55);
    this.scene.add(this.hemi);

    // cool fill from the front so faces never go black
    this.fill = new THREE.DirectionalLight(0x8f9cb8, 0.34);
    this.fill.position.set(3, 3.5, 10);
    this.fill.target.position.set(0, 2.2, 0);
    this.scene.add(this.fill, this.fill.target);

    // cool rim from behind, separating marble from the dark
    const rim = new THREE.DirectionalLight(0xa8b8d6, 0.8);
    rim.position.set(1.5, 6, -11);
    rim.target.position.set(0, 2.6, 0);
    this.scene.add(rim, rim.target);
    this.rim = rim;

    // the flame's warm pool
    this.altarLight = new THREE.PointLight(0xffa552, 6.5, 7.5, 2.0);
    this.altarLight.position.set(-1.75, 1.15, 2.5);
    this.scene.add(this.altarLight);

    // the visible shaft of light on the figure
    this._buildShaft();
  }

  _buildShaft() {
    const geo = new THREE.CylinderGeometry(0.30, 2.3, 13.5, 32, 1, true);
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color(0xffe9c4) }, uInt: { value: 0.10 } },
      vertexShader: `
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          vH = uv.y;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        precision highp float;
        uniform vec3 uColor; uniform float uInt;
        varying float vH; varying vec3 vN; varying vec3 vV;
        void main() {
          float vertical = mix(0.04, 1.0, vH);        // bright at the source
          float base = smoothstep(0.0, 0.30, vH);     // fade softly into the floor
          float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.4);
          float a = uInt * vertical * base * fres;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const shaft = this.shaft = new THREE.Mesh(geo, mat);
    // aim it down the key direction onto the figure
    shaft.position.set(-0.3, 6.9, 0.2);
    shaft.rotation.set(0.10, 0, 0.13);
    shaft.renderOrder = 3;
    this.scene.add(shaft);
  }

  // ── per-frame: the flame breathes; the day turns late ────────

  update(progress) {
    if (!this.key) return;
    const t = this.time;
    // flame flicker — small, warm, alive
    if (this.flame) {
      const fl = 0.9 + 0.14 * Math.sin(t * 11.0) + 0.08 * Math.sin(t * 27.0 + 1.3);
      this.flame.scale.setScalar(0.85 + 0.2 * fl);
      if (this.flameGlow) this.flameGlow.scale.set(1.0 + 0.22 * fl, 1.0 + 0.28 * fl, 1);
      this.altarLight.intensity = 5.6 + 1.7 * fl;
    }
    // movement V: the shaft narrows and cools, the hall darkens,
    // the fire holds
    const late = ss(progress, 0.9, 0.995);
    this.key.intensity = lerp(3.0, 1.7, late);
    this.hemi.intensity = lerp(0.55, 0.34, late);
    this.rim.intensity = lerp(0.8, 1.0, late);
    if (this.shaft) this.shaft.material.uniforms.uInt.value = lerp(0.16, 0.24, late);
    this.scene.fog.density = lerp(0.030, 0.040, late);
  }
}

// bake quiet marble variation into the reposed figure as vertex
// colour (COLOR_0) — the scan carries no UVs, so its tonal life has
// to live in the vertices: mineral drift, veined, cooler and a touch
// darker toward the base where drapery pools in its own shade
function veinFigure(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const y0 = bb.min.y, y1 = bb.max.y;
  const fbm = fbmFactory(911, 5);
  const fbmV = fbmFactory(37, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sm = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const h = (y - y0) / (y1 - y0);
    // fine mineral speckle + a slower vein running through the block
    const drift = (fbm(x * 2.6 + 11, z * 2.6 + y * 1.4) - 0.5) * 0.10;
    const vein = (fbmV(x * 0.9 + y * 0.7, z * 0.9) - 0.5) * 0.06;
    const base = (0.80 + 0.14 * sm(h)) * (1 + drift + vein);
    colors[i * 3] = base;
    colors[i * 3 + 1] = base * 0.992;
    colors[i * 3 + 2] = base * 0.978;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

// soft radial glow for the flame — additive billboard
function makeGlowTexture() {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0.0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,214,150,0.85)');
  grad.addColorStop(0.6, 'rgba(255,150,70,0.25)');
  grad.addColorStop(1.0, 'rgba(255,120,50,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
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
