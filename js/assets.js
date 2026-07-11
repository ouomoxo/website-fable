// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — assets
// The monument is carved and ambient-occlusion-baked OFFLINE
// (tools/bake-monument.mjs) and shipped as meshopt GLB — the
// browser only lights it. The bare hand is the one scanned
// element (xeogl example set, MIT, resculpted).
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { fbmFactory } from './materials.js';

const smooth = (t) => { t = Math.min(1, Math.max(0, t)); return t * t * (3 - 2 * t); };

export function loadSculptures(tier, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const suffix = tier === 'lo' ? '-lo' : '';
  const files = [
    { key: 'monument', url: `assets/models/monument${suffix}.glb` },
    { key: 'hand', url: `assets/models/hand${suffix}.glb` },
  ];
  const done = new Array(files.length).fill(0);
  const report = () => onProgress?.(done.reduce((a, b) => a + b, 0) / files.length);

  return Promise.all(files.map((f, i) => new Promise((resolve, reject) => {
    loader.load(
      f.url,
      (gltf) => {
        done[i] = 1; report();
        if (f.key === 'hand') {
          let mesh = null;
          gltf.scene.traverse((o) => { if (o.isMesh && !mesh) mesh = o; });
          resolve([f.key, prepareHand(mesh.geometry)]);
        } else {
          const parts = {};
          gltf.scene.traverse((o) => { if (o.isMesh) parts[o.name || o.parent?.name] = o.geometry; });
          resolve([f.key, parts]);
        }
      },
      (ev) => { if (ev.total) { done[i] = Math.min(0.96, ev.loaded / ev.total); report(); } },
      reject
    );
  }))).then(Object.fromEntries);
}

function prepareHand(geo) {
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h);

  // quiet mineral variation, baked as vertex color
  const fbm = fbmFactory(23 * 977 + 5, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const drift = (fbm(x * 3.1 + 7, y * 3.1 + z * 1.9) - 0.5) * 0.07;
    // baked-ambience match: the hand hangs in the hem's shade —
    // darker toward the wrist, so it sits IN the cloth, not on it
    const v = (0.86 - 0.10 * smooth(y)) * (1 + drift);
    colors[i * 3] = v;
    colors[i * 3 + 1] = v * 0.996;
    colors[i * 3 + 2] = v * 0.988;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}
