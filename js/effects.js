// ═══════════════════════════════════════════════════════════════
// KATABASIS — effects
// Dust that remembers air. Light given a body. A final pass of
// grain, vignette and tone.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// ── soft radial sprite texture ─────────────────────────────────

export function makeGlowTexture(size = 128, inner = 'rgba(255,244,224,1)', mid = 'rgba(255,236,208,0.25)') {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.35, mid);
  g.addColorStop(1, 'rgba(255,236,208,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ── dust ───────────────────────────────────────────────────────
// One Points cloud per chamber volume. Vertex shader drifts each
// mote on its own slow orbit; alpha fades near and far.

const DUST_VERT = /* glsl */`
  attribute float aSeed;
  attribute float aSize;
  uniform float uTime;
  varying float vFade;
  void main() {
    vec3 p = position;
    float t = uTime * 0.05 + aSeed * 43.7;
    p.x += sin(t * 1.7 + aSeed * 6.28) * 0.6;
    p.y += sin(t * 1.1 + aSeed * 12.4) * 0.45 + sin(t * 0.31) * 0.3;
    p.z += cos(t * 1.3 + aSeed * 9.1) * 0.6;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;
    vFade = smoothstep(1.5, 5.0, dist) * (1.0 - smoothstep(16.0, 30.0, dist));
    float size = aSize * (150.0 / dist);
    vFade *= smoothstep(0.7, 2.2, size);   // let sub-pixel motes dissolve instead of shimmering
    gl_PointSize = max(size, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const DUST_FRAG = /* glsl */`
  uniform sampler2D uMap;
  uniform float uOpacity;
  varying float vFade;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vFade * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vec3(1.0, 0.955, 0.88) * tex.rgb, a);
  }
`;

export function makeDust({ count = 400, box = [10, 8, 20], center = [0, 0, 0], opacity = 0.5, map }) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = center[0] + (Math.random() - 0.5) * box[0];
    positions[i * 3 + 1] = center[1] + (Math.random() - 0.5) * box[1];
    positions[i * 3 + 2] = center[2] + (Math.random() - 0.5) * box[2];
    seeds[i] = Math.random();
    sizes[i] = 0.16 + Math.random() * 0.55;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    vertexShader: DUST_VERT,
    fragmentShader: DUST_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uMap: { value: map },
      uOpacity: { value: opacity },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

// ── god ray cone ───────────────────────────────────────────────

const RAY_VERT = /* glsl */`
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const RAY_FRAG = /* glsl */`
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float noise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),
               mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);
  }

  void main() {
    // vUv.y: 1 at apex (top) → 0 at base
    float along = pow(vUv.y, 1.6);                       // bright at source, dissolving downward
    float edge = sin(vUv.x * 3.14159);                   // soft at silhouette edges
    edge = pow(edge, 1.6);
    float flicker = 0.75 + 0.25 * noise(vec2(vUv.x * 6.0 + uTime * 0.03, vUv.y * 3.0 - uTime * 0.05));
    float a = along * edge * flicker * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export function makeRay({ topRadius = 0.4, bottomRadius = 3.2, height = 16, color = 0xfff0d8, intensity = 0.35 }) {
  const geo = new THREE.CylinderGeometry(topRadius, bottomRadius, height, 24, 1, true);
  const mat = new THREE.ShaderMaterial({
    vertexShader: RAY_VERT,
    fragmentShader: RAY_FRAG,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uIntensity: { value: intensity },
      uTime: { value: 0 },
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return mesh;
}

// ── floor light pool ───────────────────────────────────────────

export function makePool({ radius = 4, color = 0xfff0d8, opacity = 0.22, map }) {
  const geo = new THREE.CircleGeometry(radius, 40);
  const mat = new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 4;
  return mesh;
}

// ── post pass ──────────────────────────────────────────────────
// scene → HDR target → grade: ACES tone, warm/cool split, grain,
// vignette, gentle aberration, entrance black and finale white.

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
  uniform float uWhite;    // finale white-out
  uniform float uBlack;    // entrance fade
  uniform float uAberration;
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

    // chromatic aberration, stronger at the frame edge
    float ab = uAberration * r2;
    vec3 col;
    col.r = texture2D(tScene, uv + fromCenter * ab).r;
    col.g = texture2D(tScene, uv).g;
    col.b = texture2D(tScene, uv - fromCenter * ab).b;

    // tone map (scene is rendered linear)
    col = aces(col * uExposure);

    // split tone: cool shadows, ivory highlights
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(col * vec3(0.965, 0.985, 1.03), col * vec3(1.04, 1.0, 0.94), smoothstep(0.05, 0.55, lum));

    // vignette
    float vig = 1.0 - uVignette * smoothstep(0.12, 0.62, r2);
    col *= vig;

    // grain
    float g = hash(gl_FragCoord.xy + vec2(fract(uTime * 0.37) * 311.7, fract(uTime * 0.71) * 173.3)) - 0.5;
    col += g * uGrain * (1.0 - lum * 0.6);

    // linear → sRGB
    col = pow(max(col, 0.0), vec3(1.0 / 2.2));

    // finale white / entrance black
    col = mix(col, vec3(0.93, 0.915, 0.885), uWhite);
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
        uGrain: { value: 0.04 },
        uVignette: { value: 0.45 },
        uWhite: { value: 0 },
        uBlack: { value: 1 },
        uAberration: { value: 0.003 },
        uExposure: { value: 2.0 },
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
