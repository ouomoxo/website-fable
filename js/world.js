// ═══════════════════════════════════════════════════════════════
// KLEOS — world (baked-GI, real-time)
// The marble is lit OFFLINE in Cycles (global illumination, soft
// shadows, AO) and baked into textures. Two light states — a cold
// dark and a warm glory — are baked; the browser blends between them
// by scroll (the emotional arc) and renders the geometry from any
// angle, so the visitor can orbit freely at photoreal quality with
// no per-frame cost.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';

const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;

const BLEND_VERT = /* glsl */`
  varying vec2 vUv;
  varying float vFog;
  uniform float uFogDensity;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFog = 1.0 - exp(-uFogDensity * max(0.0, -mv.z));
    gl_Position = projectionMatrix * mv;
  }`;

const BLEND_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tDark;
  uniform sampler2D tGlory;
  uniform float uMix;
  uniform vec3 uFogColor;
  varying vec2 vUv;
  varying float vFog;
  vec3 toLin(vec3 c) { return pow(c, vec3(2.2)); }
  void main() {
    vec3 d = toLin(texture2D(tDark, vUv).rgb);
    vec3 g = toLin(texture2D(tGlory, vUv).rgb);
    vec3 col = mix(d, g, uMix);
    col = mix(col, uFogColor, clamp(vFog, 0.0, 1.0));
    gl_FragColor = vec4(col, 1.0);   // linear; the post pass encodes
  }`;

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070a);
    this.time = 0;
    this.buildSteps = [];
    this._plan();
  }

  _plan() {
    this.buildSteps = [
      (onP) => this._load(onP),
      () => this._build(),
    ];
  }

  _tex(url) {
    return new Promise((res) => {
      new THREE.TextureLoader().load(url, (t) => {
        t.colorSpace = THREE.NoColorSpace;   // decoded in-shader
        t.flipY = false;                     // glTF UV convention
        t.anisotropy = 4;
        res(t);
      }, undefined, () => res(null));
    });
  }

  async _load(onProgress) {
    const names = ['figure_dark', 'figure_glory', 'arch_dark', 'arch_glory'];
    let done = 0;
    const tick = () => { done++; onProgress?.(done / (names.length + 1)); };
    const texs = {};
    await Promise.all(names.map(async (n) => { texs[n] = await this._tex(`assets/baked/${n}.webp`); tick(); }));
    this.texs = texs;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    this.gltf = await new Promise((res, rej) => loader.load('assets/baked/baked.glb', res, undefined, rej));
    tick();
  }

  _mat(dark, glory) {
    return new THREE.ShaderMaterial({
      vertexShader: BLEND_VERT, fragmentShader: BLEND_FRAG,
      uniforms: {
        tDark: { value: dark }, tGlory: { value: glory },
        uMix: { value: 0 },
        uFogColor: { value: new THREE.Color(0x05070a) },
        uFogDensity: { value: 0.028 },
      },
    });
  }

  _build() {
    const t = this.texs;
    this.figMat = this._mat(t.figure_dark, t.figure_glory);
    this.archMat = this._mat(t.arch_dark, t.arch_glory);
    this.mats = [this.figMat, this.archMat];

    const g = this.monument = new THREE.Group();
    this.scene.add(g);
    this.gltf.scene.traverse((o) => {
      if (!o.isMesh) return;
      o.material = /fig/i.test(o.name) ? this.figMat : this.archMat;
      o.frustumCulled = false;
      g.add(o.clone());
    });

    // floor: a plain dark plane with a soft contact pool
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(120, 120),
      new THREE.MeshBasicMaterial({ color: 0x0a0a0c })
    );
    floor.rotation.x = -Math.PI / 2;
    this.scene.add(floor);
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({ map: contactTex(), transparent: true, depthWrite: false, opacity: 0.9 })
    );
    decal.rotation.x = -Math.PI / 2; decal.position.y = 0.02;
    this.scene.add(decal);

    this._buildFlame();
    this._buildDust();
  }

  // the altar flame — an additive glow that ignites with the arc
  _buildFlame() {
    const pos = new THREE.Vector3(-1.75, 1.05, 2.5);
    const core = this.flame = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffd39a })
    );
    core.position.copy(pos); core.renderOrder = 2; this.scene.add(core);
    const gm = new THREE.SpriteMaterial({
      map: glowTex(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    gm.color.setRGB(1.9, 1.15, 0.5);
    const glow = this.flameGlow = new THREE.Sprite(gm);
    glow.position.copy(pos); glow.scale.set(1.1, 1.1, 1); glow.renderOrder = 2;
    this.scene.add(glow);
  }

  _buildDust() {
    const N = this.quality.assetTier === 'lo' ? 140 : 300;
    const AX = -0.3, AZ = 0.3, RAD = 2.0;
    const p = new Float32Array(N * 3), b = new Float32Array(N);
    this.dustSeed = [];
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.2832, r = Math.pow(Math.random(), 0.8) * RAD;
      const x = AX + Math.cos(a) * r, z = AZ + Math.sin(a) * r, y0 = 0.3 + Math.random() * 7;
      p[i * 3] = x; p[i * 3 + 1] = y0; p[i * 3 + 2] = z;
      b[i] = 0.25 + Math.pow(Math.random(), 1.8) * 0.75;
      this.dustSeed.push({ x, z, y0, ph: Math.random() * 6.28, sp: 0.12 + Math.random() * 0.4, amp: 0.05 + Math.random() * 0.14, yd: 0.04 + Math.random() * 0.1 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('aBright', new THREE.BufferAttribute(b, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0xffeccb) }, uAxis: { value: new THREE.Vector2(AX, AZ) }, uRad: { value: RAD }, uSize: { value: 26 }, uMix: { value: 0 }, uTwk: { value: 0 } },
      vertexShader: `uniform vec2 uAxis; uniform float uRad,uSize,uTwk; attribute float aBright; varying float vA;
        void main(){ float d=distance(position.xz,uAxis); float radial=smoothstep(uRad,uRad*0.2,d);
          float h=smoothstep(7.6,5.0,position.y)*smoothstep(0.0,1.0,position.y);
          float tw=0.7+0.3*sin(uTwk+position.y*3.1+position.x*5.0); vA=radial*h*aBright*tw;
          vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=uSize*(0.6+aBright)/max(0.4,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform float uMix; varying float vA;
        void main(){ float r=length(gl_PointCoord-0.5); if(r>0.5) discard; float s=smoothstep(0.5,0.0,r);
          gl_FragColor=vec4(uColor, vA*s*0.30*uMix); }`,
    });
    this.dust = new THREE.Points(geo, mat); this.dust.frustumCulled = false; this.dust.renderOrder = 2;
    this.scene.add(this.dust);
  }

  update(progress, time = 0) {
    if (!this.mats) return;
    const t = time;
    // the arc: dark → glory (a small floor so she's a faint cold
    // silhouette from the first frame, never a black void)
    const mix = 0.14 + 0.86 * ss(progress, 0.28, 0.70);
    for (const m of this.mats) m.uniforms.uMix.value = mix;

    // flame ignites with the arc, then breathes
    const ignite = ss(progress, 0.42, 0.64);
    const flick = 0.85 + 0.16 * Math.sin(t * 11) + 0.09 * Math.sin(t * 27 + 1.3);
    if (this.flame) this.flame.visible = ignite > 0.02, this.flame.scale.setScalar((0.6 + 0.4 * ignite) * (0.8 + 0.2 * flick));
    if (this.flameGlow) { this.flameGlow.material.opacity = ignite; this.flameGlow.scale.set(1 + 0.22 * flick, 1 + 0.28 * flick, 1); }

    if (this.dust) {
      const u = this.dust.material.uniforms; u.uTwk.value = t * 1.6; u.uMix.value = 0.2 + 0.8 * mix;
      const a = this.dust.geometry.attributes.position, s = this.dustSeed;
      for (let i = 0; i < s.length; i++) {
        const d = s[i]; let y = d.y0 - ((t * d.yd) % 7.4); if (y < 0.1) y += 7.4;
        a.array[i * 3] = d.x + Math.sin(t * d.sp + d.ph) * d.amp;
        a.array[i * 3 + 1] = y;
        a.array[i * 3 + 2] = d.z + Math.cos(t * d.sp * 0.8 + d.ph) * d.amp;
      }
      a.needsUpdate = true;
    }
  }
}

function contactTex() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.5);
  grd.addColorStop(0, 'rgba(0,0,0,0.85)'); grd.addColorStop(0.6, 'rgba(0,0,0,0.35)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = grd; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; return t;
}
function glowTex() {
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,214,150,0.85)');
  g.addColorStop(0.6, 'rgba(255,150,70,0.25)'); g.addColorStop(1, 'rgba(255,120,50,0)');
  x.fillStyle = g; x.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
