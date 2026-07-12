// ═══════════════════════════════════════════════════════════════
// KLEOS — effects
// One finishing pass: tone, a gentle split grade, near-invisible
// grain, quiet vignette, entrance black.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// ── post pass ──────────────────────────────────────────────────
// scene → HDR target → grade: ACES tone, a gentle warm/cool split,
// near-invisible grain, quiet vignette, entrance black.

const POST_VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const POST_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tScene;
  uniform sampler2D tBloom;
  uniform float uBloom;
  uniform float uTime;
  uniform float uGrain;
  uniform float uVignette;
  uniform float uBlack;    // entrance fade
  uniform float uExposure;
  varying vec2 vUv;

  vec3 aces(vec3 x) {
    const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec2 uv = vUv;
    vec2 fromCenter = uv - 0.5;
    float r2 = dot(fromCenter, fromCenter);

    vec3 col = texture2D(tScene, uv).rgb;

    // add bloom in linear HDR, before the tone map, so it rolls off
    col += texture2D(tBloom, uv).rgb * uBloom;

    // tone map (scene is rendered linear)
    col = aces(col * uExposure);

    // split tone: shadows drift cool, highlights toward aged ivory
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col * vec3(0.972, 0.988, 1.025), col * vec3(1.03, 1.0, 0.955), smoothstep(0.05, 0.55, lum));

    // shadows never crush to zero — the dark stays material
    col = col * 0.982 + vec3(0.0105, 0.0095, 0.0085);

    // vignette
    float vig = 1.0 - uVignette * smoothstep(0.14, 0.65, r2);
    col *= vig;

    // grain — barely there
    float g = hash(gl_FragCoord.xy + vec2(fract(uTime * 0.37) * 311.7, fract(uTime * 0.71) * 173.3)) - 0.5;
    col += g * uGrain * (1.0 - lum * 0.6);

    // linear → sRGB
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    // entrance black
    col = mix(col, vec3(0.0), uBlack);

    gl_FragColor = vec4(col, 1.0);
  }
`;

// bright-pass: keep only what burns past the threshold — the flame,
// the torch's edge, speculars — so bloom never washes the marble flat
const BRIGHT_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tScene;
  uniform float uThreshold, uSoft;
  varying vec2 vUv;
  void main() {
    vec3 c = texture2D(tScene, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(uThreshold, uThreshold + uSoft, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

// separable gaussian blur — nine taps, run horizontal then vertical
const BLUR_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D tSrc;
  uniform vec2 uDir;          // texel * direction
  varying vec2 vUv;
  void main() {
    vec3 s = texture2D(tSrc, vUv).rgb * 0.227027;
    s += texture2D(tSrc, vUv + uDir * 1.3846).rgb * 0.316216;
    s += texture2D(tSrc, vUv - uDir * 1.3846).rgb * 0.316216;
    s += texture2D(tSrc, vUv + uDir * 3.2308).rgb * 0.070270;
    s += texture2D(tSrc, vUv - uDir * 3.2308).rgb * 0.070270;
    gl_FragColor = vec4(s, 1.0);
  }
`;

export class PostPass {
  constructor(renderer, width, height, dpr) {
    this.renderer = renderer;
    const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const mkTarget = (w, h) => new THREE.WebGLRenderTarget(w, h, {
      type, format: THREE.RGBAFormat, colorSpace: THREE.LinearSRGBColorSpace,
    });
    const W = Math.floor(width * dpr), H = Math.floor(height * dpr);
    this.target = mkTarget(W, H);
    // bloom chain at half resolution
    this.bloomW = Math.max(1, W >> 1); this.bloomH = Math.max(1, H >> 1);
    this.btA = mkTarget(this.bloomW, this.bloomH);
    this.btB = mkTarget(this.bloomW, this.bloomH);

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.bright = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: BRIGHT_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tScene: { value: this.target.texture }, uThreshold: { value: 1.15 }, uSoft: { value: 0.6 } },
    });
    this.blur = new THREE.ShaderMaterial({
      vertexShader: POST_VERT, fragmentShader: BLUR_FRAG, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    });
    this.material = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tScene: { value: this.target.texture },
        tBloom: { value: this.btA.texture },
        uBloom: { value: 0.6 },
        uTime: { value: 0 },
        uGrain: { value: 0.016 },
        uVignette: { value: 0.30 },
        uBlack: { value: 1 },
        uExposure: { value: 0.98 },
      },
      depthTest: false,
      depthWrite: false,
    });
    // fullscreen triangle
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(width, height, dpr) {
    const W = Math.floor(width * dpr), H = Math.floor(height * dpr);
    this.target.setSize(W, H);
    this.bloomW = Math.max(1, W >> 1); this.bloomH = Math.max(1, H >> 1);
    this.btA.setSize(this.bloomW, this.bloomH);
    this.btB.setSize(this.bloomW, this.bloomH);
  }

  _pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  render(scene, camera, time) {
    const r = this.renderer;
    // 1. scene → HDR target
    r.setRenderTarget(this.target);
    r.render(scene, camera);

    // 2. bright pass → btA
    this._pass(this.bright, this.btA);
    // 3. blur: two separable iterations, btA ↔ btB
    const tx = 1 / this.bloomW, ty = 1 / this.bloomH;
    for (let i = 0; i < 2; i++) {
      this.blur.uniforms.tSrc.value = this.btA.texture;
      this.blur.uniforms.uDir.value.set(tx, 0);
      this._pass(this.blur, this.btB);
      this.blur.uniforms.tSrc.value = this.btB.texture;
      this.blur.uniforms.uDir.value.set(0, ty);
      this._pass(this.blur, this.btA);
    }

    // 4. grade + bloom → screen
    this.material.uniforms.uTime.value = time;
    this.quad.material = this.material;
    r.setRenderTarget(null);
    r.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.btA.dispose();
    this.btB.dispose();
    this.material.dispose();
    this.bright.dispose();
    this.blur.dispose();
    this.geo.dispose();
  }
}
