// ═══════════════════════════════════════════════════════════════
// KATABASIS — assets
// Scanned sculpture. Lucy — Stanford 3D Scanning Repository.
// Igea — Cyberware sample scan. Meshopt-compressed GLB, normalized
// here to unit height with the base at y = 0, and tinted per-vertex
// so the stone carries quiet tonal variation without UVs.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { fbmFactory } from './materials.js';

const MODELS = {
  // rx/ry: orientation fix baked into geometry (float32 — safe to bake)
  lucy: { rx: -Math.PI / 2, ry: Math.PI, seed: 71 },
  igea: { rx: 0, ry: 0, seed: 37 },
};

export function loadSculptures(tier, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const suffix = tier === 'lo' ? '-lo' : '';
  const names = Object.keys(MODELS);
  const done = new Array(names.length).fill(0);
  const report = () => onProgress?.(done.reduce((a, b) => a + b, 0) / names.length);

  return Promise.all(names.map((name, i) => new Promise((resolve, reject) => {
    loader.load(
      `assets/models/${name}${suffix}.glb`,
      (gltf) => {
        let mesh = null;
        gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
        done[i] = 1; report();
        resolve([name, prepare(mesh.geometry, MODELS[name])]);
      },
      (ev) => { if (ev.total) { done[i] = Math.min(0.96, ev.loaded / ev.total); report(); } },
      reject
    );
  }))).then(Object.fromEntries);
}

function prepare(geo, { rx, ry, seed }) {
  // stand the scan up first (rx), then turn it to face forward (ry)
  geo.applyMatrix4(
    new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx))
  );
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h);

  // quiet mineral variation + grounding at the base, baked as colors
  const fbm = fbmFactory(seed * 977 + 5, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const drift = (fbm(x * 2.1 + 7, y * 2.1 + z * 1.3) - 0.5) * 0.09;
    const ground = 0.9 + 0.1 * Math.min(1, y / 0.12);
    const v = (1 + drift) * ground;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v * 0.995;
    colors[i * 3 + 2] = v * 0.985;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}
