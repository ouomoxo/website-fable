// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — effects
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

    // tone map (scene is rendered linear)
    col = aces(col * uExposure);

    // split tone: shadows drift cool, highlights toward aged ivory
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col * vec3(0.972, 0.988, 1.025), col * vec3(1.03, 1.0, 0.955), smoothstep(0.05, 0.55, lum));

    // shadows never crush to zero — the dark stays material
    col = col * 0.985 + vec3(0.0075, 0.0068, 0.006);

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

export class PostPass {
  constructor(renderer, width, height, dpr) {
    this.renderer = renderer;
    const type = renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.target = new THREE.WebGLRenderTarget(width * dpr, height * dpr, {
      type,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
    });
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.material = new THREE.ShaderMaterial({
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tScene: { value: this.target.texture },
        uTime: { value: 0 },
        uGrain: { value: 0.016 },
        uVignette: { value: 0.30 },
        uBlack: { value: 1 },
        uExposure: { value: 1.45 },
      },
      depthTest: false,
      depthWrite: false,
    });
    // fullscreen triangle
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 2, 0, 0, 2]), 2));
    this.quad = new THREE.Mesh(geo, this.material);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
  }

  setSize(width, height, dpr) {
    this.target.setSize(Math.floor(width * dpr), Math.floor(height * dpr));
  }

  render(scene, camera, time) {
    const u = this.material.uniforms;
    u.uTime.value = time;
    this.renderer.setRenderTarget(this.target);
    this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.target.dispose();
    this.material.dispose();
    this.quad.geometry.dispose();
  }
}
