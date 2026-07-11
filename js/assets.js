// ═══════════════════════════════════════════════════════════════
// ANAMNESIS — assets
// Scanned sculpture. Lucy — Stanford 3D Scanning Repository.
// Igea — Cyberware sample scan. Meshopt-compressed GLB, normalized
// here to unit height with the base at y = 0, and tinted per-vertex
// so the stone carries quiet tonal variation without UVs.
//
// The winged figure is never kept whole: sliceFigure() divides it
// into separate anatomical fragments (the complete body exists only
// as a perceptual alignment), and bakePigment() writes traces of
// lost polychromy into each fragment's vertices.
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

// ── sliceFigure ────────────────────────────────────────────────
// Divide the winged figure into separate fragments by anatomical
// region, classifying each triangle by its centroid in the
// normalized figure space (unit height, base at y = 0). The head
// triangles are discarded — the face of the reconstruction is the
// goddess's head, a different stone entirely.

const REGIONS = [
  { name: 'discardHead', test: (x, y, z) => y > 0.80 && Math.abs(x) < 0.10 && z > -0.06 },
  { name: 'wingL', test: (x, y) => x < -0.13 && y > 0.30 },
  { name: 'wingR', test: (x, y) => x > 0.13 && y > 0.30 },
  { name: 'torso', test: (x, y) => y >= 0.42 },
  { name: 'lower', test: () => true },
];

export function sliceFigure(geo) {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const col = geo.attributes.color;
  const idx = geo.index.array;
  const buckets = {};
  for (const r of REGIONS) if (r.name !== 'discardHead') buckets[r.name] = [];

  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
    const cy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
    const cz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
    for (const r of REGIONS) {
      if (r.test(cx, cy, cz)) {
        if (r.name !== 'discardHead') buckets[r.name].push(a, b, c);
        break;
      }
    }
  }

  const out = {};
  for (const [name, tris] of Object.entries(buckets)) {
    const remap = new Map();
    const order = [];
    const newIdx = new Uint32Array(tris.length);
    for (let i = 0; i < tris.length; i++) {
      let m = remap.get(tris[i]);
      if (m === undefined) { m = order.length; remap.set(tris[i], m); order.push(tris[i]); }
      newIdx[i] = m;
    }
    const g = new THREE.BufferGeometry();
    const copy = (attr, size) => {
      const arr = new Float32Array(order.length * size);
      for (let i = 0; i < order.length; i++)
        for (let k = 0; k < size; k++) arr[i * size + k] = attr.array[order[i] * size + k];
      return new THREE.BufferAttribute(arr, size);
    };
    g.setAttribute('position', copy(pos, 3));
    g.setAttribute('normal', copy(nrm, 3));
    if (col) g.setAttribute('color', copy(col, 3));
    g.setIndex(new THREE.BufferAttribute(newIdx, 1));
    g.computeBoundingBox();
    g.computeBoundingSphere();
    out[name] = g;
  }
  return out;
}

// ── bakePigment ────────────────────────────────────────────────
// Traces of lost polychromy, written per vertex as [r, g, b, mask].
// Pigment survives as evidence — in recesses, along a garment
// border, under feather edges — never as a coat of paint. The
// marks are interrupted by erosion noise so that, like memory,
// none of them is complete.

const PIG = {
  blue: [0.13, 0.27, 0.52],
  ochre: [0.55, 0.27, 0.14],
  black: [0.09, 0.08, 0.08],
  green: [0.22, 0.34, 0.24],
  gild: [0.62, 0.48, 0.22],
};

export function bakePigment(geo, kind, seed = 9) {
  const fbm = fbmFactory(seed * 271 + 3, 4);
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const out = new Float32Array(pos.count * 4);
  const set = (i, rgb, a) => {
    out[i * 4] = rgb[0]; out[i * 4 + 1] = rgb[1]; out[i * 4 + 2] = rgb[2]; out[i * 4 + 3] = a;
  };
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const ny = nrm.getY(i);
    const n1 = fbm(x * 26 + 5, y * 26 + z * 9);
    const n2 = fbm(x * 9 - 3, y * 9 + z * 4);
    let rgb = null, a = 0;

    if (kind === 'lower') {
      // garment hem: an ochre band with a black border, broken by loss
      if (y > 0.055 && y < 0.105 && n1 > 0.42) { rgb = PIG.ochre; a = 0.55 * Math.min(1, (n1 - 0.42) * 5); }
      else if (y >= 0.105 && y < 0.122 && n1 > 0.5) { rgb = PIG.black; a = 0.5; }
      // deep folds keep a breath of blue
      else if (Math.abs(ny) < 0.25 && n2 > 0.62) { rgb = PIG.blue; a = 0.4 * (n2 - 0.62) * 3; }
    } else if (kind === 'torso') {
      // a sash border crossing the chest, mostly lost
      const band = y - 0.62 + x * 0.35;
      if (Math.abs(band) < 0.018 && n1 > 0.52) { rgb = PIG.ochre; a = 0.45; }
      else if (Math.abs(ny) < 0.2 && n2 > 0.66) { rgb = PIG.blue; a = 0.32; }
    } else if (kind === 'wing') {
      // covert rows: alternating blue and green, kept under the edges
      const row = Math.sin(y * 34 + n2 * 3);
      if (row > 0.55 && n1 > 0.5) { rgb = PIG.blue; a = 0.4 * (n1 - 0.5) * 2.4; }
      else if (row < -0.6 && n1 > 0.56) { rgb = PIG.green; a = 0.3 * (n1 - 0.56) * 2.8; }
    } else if (kind === 'head') {
      // a diadem line at the hair's edge, a few flakes of gilding
      if (y > 0.72 && y < 0.80 && n1 > 0.55) { rgb = PIG.gild; a = 0.4; }
      else if (y > 0.34 && y < 0.44 && Math.abs(ny) < 0.3 && n2 > 0.64) { rgb = PIG.ochre; a = 0.28; }
    }
    set(i, rgb || PIG.blue, rgb ? a : 0);
  }
  geo.setAttribute('aPig', new THREE.BufferAttribute(out, 4));
  return geo;
}
