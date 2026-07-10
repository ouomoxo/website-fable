// ═══════════════════════════════════════════════════════════════
// KATABASIS — materials
// Procedural marble, bronze and stone. No textures were downloaded;
// every vein is computed.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';

// ── seeded value noise ─────────────────────────────────────────

function makeNoise(seed) {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const SIZE = 256;
  const grid = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < grid.length; i++) grid[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const x0 = xi & (SIZE - 1), y0 = yi & (SIZE - 1);
    const x1 = (x0 + 1) & (SIZE - 1), y1 = (y0 + 1) & (SIZE - 1);
    const a = grid[y0 * SIZE + x0], b = grid[y0 * SIZE + x1];
    const c = grid[y1 * SIZE + x0], d = grid[y1 * SIZE + x1];
    const u = fade(xf), v = fade(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}

export function fbmFactory(seed, octaves = 5) {
  const n = makeNoise(seed);
  return function fbm(x, y) {
    let amp = 0.5, f = 1, sum = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * n(x * f, y * f);
      amp *= 0.5;
      f *= 2.03;
    }
    return sum;
  };
}

// ── marble canvas texture ──────────────────────────────────────
// Thin dark veins along the zero-crossings of a warped sine field,
// low-frequency tonal clouds, fine grain.

export function makeMarbleTexture({
  size = 512,
  base = [0.80, 0.77, 0.71],
  vein = [0.42, 0.40, 0.37],
  veinStrength = 0.55,
  cloud = 0.10,
  scale = 1,
  seed = 7,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const fbm = fbmFactory(seed, 5);
  const fbm2 = fbmFactory(seed + 101, 4);
  const inv = 1 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * inv * scale, v = y * inv * scale;
      // warped stripes → veins
      const warp = fbm(u * 4, v * 4) * 6.0;
      const field = Math.sin((u * 5 + v * 11) * 2.2 + warp * 2.6);
      let veinMask = Math.pow(1 - Math.abs(field), 18);          // razor-thin main veins
      veinMask += 0.35 * Math.pow(1 - Math.abs(Math.sin((u * 13 - v * 7) * 1.7 + warp * 1.4)), 26); // secondary
      veinMask = Math.min(1, veinMask) * veinStrength;

      const clouds = (fbm2(u * 3, v * 3) - 0.5) * 2 * cloud;      // broad tonal drift
      const grain = (fbm2(u * 60, v * 60) - 0.5) * 0.045;         // fine crystalline grain

      for (let c = 0; c < 3; c++) {
        let val = base[c] + clouds + grain;
        val = val * (1 - veinMask) + vein[c] * veinMask;
        data[(y * size + x) * 4 + c] = Math.max(0, Math.min(255, val * 255));
      }
      data[(y * size + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ── material set ───────────────────────────────────────────────

export function createMaterials(renderer, quality) {
  const texSize = quality.texSize;

  const marbleTex = makeMarbleTexture({
    size: texSize,
    base: [0.82, 0.79, 0.74],
    vein: [0.48, 0.46, 0.43],
    veinStrength: 0.3,
    scale: 1.4,
    seed: 7,
  });
  marbleTex.repeat.set(2, 3);

  const shroudTex = makeMarbleTexture({
    size: texSize,
    base: [0.84, 0.81, 0.77],
    vein: [0.56, 0.54, 0.51],
    veinStrength: 0.22,
    cloud: 0.06,
    scale: 1.2,
    seed: 23,
  });

  const floorTex = makeMarbleTexture({
    size: texSize,
    base: [0.152, 0.148, 0.138],
    vein: [0.24, 0.23, 0.21],
    veinStrength: 0.22,
    cloud: 0.035,
    scale: 1.6,
    seed: 51,
  });
  floorTex.repeat.set(14, 14);

  const env = makeEnvironmentSafe(renderer);

  const marble = new THREE.MeshStandardMaterial({
    map: marbleTex,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.5,
  });

  const shroud = new THREE.MeshStandardMaterial({
    map: shroudTex,
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.35,
  });

  const floor = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: 0xffffff,
    roughness: 0.42,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.8,
  });

  const stone = new THREE.MeshStandardMaterial({
    map: marbleTex,
    color: 0x6e695f,
    roughness: 0.92,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.15,
  });

  const bronze = new THREE.MeshStandardMaterial({
    color: 0x6d5632,
    roughness: 0.45,
    metalness: 0.9,
    envMap: env,
    envMapIntensity: 1.2,
  });

  return { marble, shroud, floor, stone, bronze, env };
}

function makeEnvironmentSafe(renderer) {
  try {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 24, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x0b0a09 })
    ));
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(18, 6),
      new THREE.MeshBasicMaterial({ color: 0x9fa8b4 })
    );
    slit.position.set(0, 40, 0);
    slit.rotation.x = Math.PI / 2;
    scene.add(slit);
    const warm = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 16),
      new THREE.MeshBasicMaterial({ color: 0x3a2f1e })
    );
    warm.position.set(-30, 8, 0);
    warm.rotation.y = Math.PI / 2;
    scene.add(warm);
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envMap = pmrem.fromScene(scene, 0.03).texture;
    pmrem.dispose();
    return envMap;
  } catch (e) {
    return null;
  }
}
