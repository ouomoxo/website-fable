// ═══════════════════════════════════════════════════════════════
// ANAMNESIS — materials
// Aged ivory marble, limestone walls, dark honed floors.
// Every surface is computed; nothing is pure white, nothing is
// pure black.
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

// ── marble: faint veining, tonal clouds, crystalline grain ─────

export function makeMarbleTexture({
  size = 512,
  base = [0.66, 0.62, 0.55],
  vein = [0.44, 0.42, 0.38],
  veinStrength = 0.35,
  cloud = 0.08,
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
      const warp = fbm(u * 4, v * 4) * 6.0;
      const field = Math.sin((u * 5 + v * 11) * 2.2 + warp * 2.6);
      let veinMask = Math.pow(1 - Math.abs(field), 18);
      veinMask += 0.35 * Math.pow(1 - Math.abs(Math.sin((u * 13 - v * 7) * 1.7 + warp * 1.4)), 26);
      veinMask = Math.min(1, veinMask) * veinStrength;

      const clouds = (fbm2(u * 3, v * 3) - 0.5) * 2 * cloud;
      const grain = (fbm2(u * 60, v * 60) - 0.5) * 0.04;

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
  tex.anisotropy = 8;
  return tex;
}

// ── limestone: no veins — broad mottling, sediment bands, grit ─

export function makeLimestoneTexture({
  size = 512,
  base = [0.30, 0.275, 0.24],
  range = 0.10,
  bands = 0.05,
  scale = 1,
  seed = 91,
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;

  const fbm = fbmFactory(seed, 5);
  const fbm2 = fbmFactory(seed + 57, 4);
  const inv = 1 / size;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * inv * scale, v = y * inv * scale;
      const mottle = (fbm(u * 2.4, v * 2.4) - 0.5) * 2 * range;
      const band = Math.sin(v * 26 + fbm(u * 3, v * 1.5) * 5) * bands * fbm2(u * 1.2, v * 0.8);
      const grit = (fbm2(u * 48, v * 48) - 0.5) * 0.05;
      const t = mottle + band + grit;
      for (let c = 0; c < 3; c++) {
        const val = base[c] * (1 + t * (c === 2 ? 1.25 : 1)); // shadows drift cooler
        data[(y * size + x) * 4 + c] = Math.max(0, Math.min(255, val * 255));
      }
      data[(y * size + x) * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// grayscale bump derived from a second noise pass — micro relief
function makeBumpTexture({ size = 256, scale = 1, seed = 5, strength = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const fbm = fbmFactory(seed, 5);
  const inv = 1 / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x * inv * scale, v = y * inv * scale;
      const n = 0.5 + (fbm(u * 14, v * 14) - 0.5) * strength + (fbm(u * 55, v * 55) - 0.5) * 0.4 * strength;
      const val = Math.max(0, Math.min(255, n * 255));
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = val;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

// ── material set ───────────────────────────────────────────────

export function createMaterials(renderer, quality) {
  const texSize = quality.texSize;

  // aged ivory — architectural marble (plinths, lintels)
  const marbleTex = makeMarbleTexture({
    size: texSize,
    base: [0.60, 0.565, 0.50],
    vein: [0.42, 0.40, 0.37],
    veinStrength: 0.22,
    cloud: 0.07,
    scale: 1.4,
    seed: 7,
  });
  marbleTex.repeat.set(1, 1);

  // the figures — slightly warmer, calmer stone
  const figureTex = makeMarbleTexture({
    size: texSize,
    base: [0.64, 0.60, 0.535],
    vein: [0.50, 0.475, 0.43],
    veinStrength: 0.13,
    cloud: 0.05,
    scale: 1.2,
    seed: 23,
  });

  // walls — deep umber limestone, coarse
  const wallTex = makeLimestoneTexture({
    size: texSize,
    base: [0.235, 0.21, 0.175],
    range: 0.13,
    bands: 0.05,
    scale: 1.5,
    seed: 91,
  });
  wallTex.repeat.set(3, 2);

  // floor — dark honed stone
  const floorTex = makeLimestoneTexture({
    size: texSize,
    base: [0.17, 0.158, 0.138],
    range: 0.09,
    bands: 0.02,
    scale: 2.0,
    seed: 51,
  });
  floorTex.repeat.set(10, 10);

  const bumpFine = makeBumpTexture({ size: 256, scale: 1.3, seed: 12, strength: 1 });
  bumpFine.repeat.set(2, 2);
  const bumpCoarse = makeBumpTexture({ size: 256, scale: 1.8, seed: 31, strength: 1.6 });
  bumpCoarse.repeat.set(3, 2);

  const env = makeEnvironmentSafe(renderer);

  const marble = new THREE.MeshStandardMaterial({
    map: marbleTex,
    bumpMap: bumpFine,
    bumpScale: 0.6,
    roughness: 0.70,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.20,
  });

  // figures carry baked cavity shading in vertex colors
  const figure = new THREE.MeshStandardMaterial({
    map: figureTex,
    bumpMap: bumpFine,
    bumpScale: 0.35,
    roughness: 0.78,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.10,
    vertexColors: true,
  });

  // scanned sculpture — no UVs; tonal variation lives in vertex colors
  const scan = new THREE.MeshStandardMaterial({
    color: 0xb8ad99,
    roughness: 0.78,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.15,
    vertexColors: true,
  });

  // fragment stone: the same material carrying traces of pigment in
  // the aPig vertex attribute; uPigment reveals them near alignment
  const makeFragmentStone = () => {
    const m = scan.clone();
    m.customUniforms = { uPigment: { value: 0 } };
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uPigment = m.customUniforms.uPigment;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec4 aPig;\nvarying vec4 vPig;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPig = aPig;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uPigment;\nvarying vec4 vPig;')
        .replace(
          '#include <color_fragment>',
          '#include <color_fragment>\n' +
          'diffuseColor.rgb = mix(diffuseColor.rgb, vPig.rgb, vPig.a * uPigment);'
        );
    };
    return m;
  };

  const wall = new THREE.MeshStandardMaterial({
    map: wallTex,
    bumpMap: bumpCoarse,
    bumpScale: 1.2,
    roughness: 0.94,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.08,
  });

  const floor = new THREE.MeshStandardMaterial({
    map: floorTex,
    bumpMap: bumpFine,
    bumpScale: 0.3,
    roughness: 0.55,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.35,
  });

  const stone = new THREE.MeshStandardMaterial({
    map: wallTex,
    bumpMap: bumpCoarse,
    bumpScale: 0.9,
    color: 0xcfc8bc,
    roughness: 0.88,
    metalness: 0.0,
    envMap: env,
    envMapIntensity: 0.12,
  });

  return { marble, figure, scan, makeFragmentStone, wall, floor, stone, env };
}

// dim architectural environment — one pale overhead opening,
// one faint warm side — so speculars have something honest to see
function makeEnvironmentSafe(renderer) {
  try {
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(50, 24, 16),
      new THREE.MeshBasicMaterial({ side: THREE.BackSide, color: 0x0b0a09 })
    ));
    const slit = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 5),
      new THREE.MeshBasicMaterial({ color: 0x8b93a0 })
    );
    slit.position.set(0, 40, 0);
    slit.rotation.x = Math.PI / 2;
    scene.add(slit);
    const warm = new THREE.Mesh(
      new THREE.PlaneGeometry(5, 14),
      new THREE.MeshBasicMaterial({ color: 0x35291a })
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
