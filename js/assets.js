// ═══════════════════════════════════════════════════════════════
// KLEOS — assets
// The monument is prepared OFFLINE in Blender (tools/repose-monument
// — the Stanford "Lucy" winged-Victory scan, stood and set on a
// classical pedestal) and shipped as a meshopt GLB with named parts
// (figure, pedestal). The browser only lights it and grades the frame.
// ═══════════════════════════════════════════════════════════════

import { GLTFLoader } from './lib/GLTFLoader.js';
import { MeshoptDecoder } from './lib/meshopt_decoder.module.js';

export function loadSculptures(tier, onProgress) {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const suffix = tier === 'lo' ? '-lo' : '';
  const files = [
    { key: 'monument', url: `assets/models/monument${suffix}.glb` },
    { key: 'set', url: `assets/models/set.glb` },
  ];
  const done = new Array(files.length).fill(0);
  const report = () => onProgress?.(done.reduce((a, b) => a + b, 0) / files.length);

  return Promise.all(files.map((f, i) => new Promise((resolve, reject) => {
    loader.load(
      f.url,
      (gltf) => {
        done[i] = 1; report();
        const parts = {};
        gltf.scene.traverse((o) => { if (o.isMesh) parts[o.name || o.parent?.name] = o.geometry; });
        resolve([f.key, parts]);
      },
      (ev) => { if (ev.total) { done[i] = Math.min(0.96, ev.loaded / ev.total); report(); } },
      reject
    );
  }))).then(Object.fromEntries);
}
