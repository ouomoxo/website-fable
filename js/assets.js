// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — assets
// One scanned element: the bare forearm and hand that hang over
// the altar's edge (hand mesh from the xeogl example set, MIT,
// Loop-subdivided offline to carving density). Everything else in
// the monument is carved procedurally at load.
// Normalized here to unit height with baked stone tint.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';
import { fbmFactory } from './materials.js';

const MODELS = {
  hand: { rx: 0, ry: 0, seed: 23 },
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
  geo.applyMatrix4(
    new THREE.Matrix4().makeRotationY(ry).multiply(new THREE.Matrix4().makeRotationX(rx))
  );
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const h = bb.max.y - bb.min.y;
  geo.translate(-(bb.min.x + bb.max.x) / 2, -bb.min.y, -(bb.min.z + bb.max.z) / 2);
  geo.scale(1 / h, 1 / h, 1 / h);

  // quiet mineral variation, baked as vertex color
  const fbm = fbmFactory(seed * 977 + 5, 4);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const drift = (fbm(x * 3.1 + 7, y * 3.1 + z * 1.9) - 0.5) * 0.07;
    const v = 1 + drift;
    colors[i * 3] = v;
    colors[i * 3 + 1] = v * 0.996;
    colors[i * 3 + 2] = v * 0.988;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeBoundingSphere();
  return geo;
}
