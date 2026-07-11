// ═══════════════════════════════════════════════════════════════
// AFTER EMELYN — volumetric figure sculpt (SDF → Surface Nets)
//
// The mourning figure is no longer a displaced sheet. It is a
// watertight VOLUME defined by a signed distance field built from
// an anatomical skeleton of primitives (pelvis, ribcage, shoulders,
// neck, buried head, folded arm, hanging forearm, thighs), wrapped
// in a cloth offset with carved fold grooves. Meshed with Surface
// Nets, ambient-occlusion baked directly from the SDF, exported as
// meshopt GLB.
//
//   node sculpt-figure.mjs <repo-root> [draft|hi]
// ═══════════════════════════════════════════════════════════════

import { Document, NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression } from '@gltf-transform/extensions';
import { reorder, prune } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import { writeFileSync } from 'fs';

const REPO = process.argv[2] ?? '/home/user/website-fable';
const MODE = process.argv[3] ?? 'hi';
const VOX = MODE === 'draft' ? 0.020 : 0.010;

// ── vector-free scalar SDF primitives ──────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const mix = (a, b, t) => a + (b - a) * t;
// smooth min (polynomial) — organic blends
function smin(a, b, k) {
  const h = clamp01(0.5 + 0.5 * (b - a) / k);
  return mix(b, a, h) - k * h * (1 - h);
}
function smax(a, b, k) { return -smin(-a, -b, k); }

function sdSphere(px, py, pz, cx, cy, cz, r) {
  const dx = px - cx, dy = py - cy, dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}
// axis-scaled ellipsoid (approximate distance)
function sdEllipsoid(px, py, pz, cx, cy, cz, rx, ry, rz) {
  const dx = (px - cx) / rx, dy = (py - cy) / ry, dz = (pz - cz) / rz;
  const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (k0 === 0) return -Math.min(rx, ry, rz);
  const nx = (px - cx) / (rx * rx), ny = (py - cy) / (ry * ry), nz = (pz - cz) / (rz * rz);
  const k1 = Math.sqrt(nx * nx + ny * ny + nz * nz);
  return k0 * (k0 - 1.0) / k1;
}
// rounded capsule between a and b, radius r (optionally r2 at b)
function sdCapsule(px, py, pz, ax, ay, az, bx, by, bz, r, r2) {
  const pax = px - ax, pay = py - ay, paz = pz - az;
  const bax = bx - ax, bay = by - ay, baz = bz - az;
  const baLen2 = bax * bax + bay * bay + baz * baz;
  let h = baLen2 > 1e-9 ? (pax * bax + pay * bay + paz * baz) / baLen2 : 0;
  h = clamp01(h);
  const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
  const rr = r2 === undefined ? r : mix(r, r2, h);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - rr;
}
// rounded box
function sdRoundBox(px, py, pz, cx, cy, cz, hx, hy, hz, r) {
  const qx = Math.abs(px - cx) - hx, qy = Math.abs(py - cy) - hy, qz = Math.abs(pz - cz) - hz;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0), oz = Math.max(qz, 0);
  const outside = Math.sqrt(ox * ox + oy * oy + oz * oz);
  const inside = Math.min(Math.max(qx, Math.max(qy, qz)), 0);
  return outside + inside - r;
}

// ── seeded noise for fold grooves & surface ────────────────────
function makeNoise(seed) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const N = 64;
  const g = new Float32Array(N * N * N);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const fade = (t) => t * t * (3 - 2 * t);
  return function (x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const X = xi & (N - 1), Y = yi & (N - 1), Z = zi & (N - 1);
    const X1 = (X + 1) & (N - 1), Y1 = (Y + 1) & (N - 1), Z1 = (Z + 1) & (N - 1);
    const u = fade(xf), v = fade(yf), w = fade(zf);
    const c000 = g[X + N * (Y + N * Z)], c100 = g[X1 + N * (Y + N * Z)];
    const c010 = g[X + N * (Y1 + N * Z)], c110 = g[X1 + N * (Y1 + N * Z)];
    const c001 = g[X + N * (Y + N * Z1)], c101 = g[X1 + N * (Y + N * Z1)];
    const c011 = g[X + N * (Y1 + N * Z1)], c111 = g[X1 + N * (Y1 + N * Z1)];
    const x00 = mix(c000, c100, u), x10 = mix(c010, c110, u);
    const x01 = mix(c001, c101, u), x11 = mix(c011, c111, u);
    return mix(mix(x00, x10, v), mix(x01, x11, v), w);
  };
}
const noise = makeNoise(1337);
function fbm(x, y, z) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < 4; i++) { s += a * noise(x * f, y * f, z * f); a *= 0.5; f *= 2.02; }
  return s;
}

// ═══ THE FIGURE FIELD ═════════════════════════════════════════
// Composition after the reference: a TALL pedestal (top y≈2.42).
// The figure kneels BEHIND it and collapses forward over the top —
// the head rests on the folded (left) arm on the top surface, the
// far (right) arm hangs down the FRONT face, and the garment
// cascades down the LEFT side and back under a great wing that rises
// then falls (the wing is a separate explicit-feather mesh).
// Viewer at +z; head toward front-right (+x,+z); drapery to the left.
const SLAB_Y = 2.42;                             // pedestal top
const PHW = 0.85;                                // pedestal top half-width

function figureBase(px, py, pz) {
  const K = 0.30;

  // upper back cresting over the top-back edge — the visible mass
  let d = sdEllipsoid(px, py, pz, 0.16, 2.56, -0.12, 0.56, 0.34, 0.50);
  // shoulder girdle on the top surface
  d = smin(d, sdEllipsoid(px, py, pz, 0.06, 2.52, 0.14, 0.52, 0.30, 0.46), K);
  // torso falling behind the pedestal (mostly hidden)
  d = smin(d, sdEllipsoid(px, py, pz, 0.20, 1.95, -0.66, 0.52, 0.52, 0.50), 0.28);
  d = smin(d, sdEllipsoid(px, py, pz, 0.24, 1.32, -1.02, 0.52, 0.46, 0.46), 0.28);

  // neck bowing forward-right + HEAD sunk on the folded arm, the
  // face turned down into the crook (never shown)
  d = smin(d, sdCapsule(px, py, pz, 0.18, 2.54, 0.14, 0.42, 2.52, 0.44, 0.16, 0.15), 0.13);
  d = smin(d, sdEllipsoid(px, py, pz, 0.48, 2.56, 0.50, 0.25, 0.26, 0.27), 0.10);
  // HAIR — a gathered mass over the crown, parted and flowing back;
  // slightly proud of the skull so it reads as hair, not scalp
  d = smin(d, sdEllipsoid(px, py, pz, 0.44, 2.62, 0.40, 0.30, 0.24, 0.32), 0.09);

  // FOLDED (left) arm: shoulder → elbow → forearm along the front-top
  // edge, cradling the head in its crook
  d = smin(d, sdCapsule(px, py, pz, -0.10, 2.50, 0.06, -0.16, 2.46, 0.46, 0.155, 0.135), 0.11);
  d = smin(d, sdCapsule(px, py, pz, -0.16, 2.46, 0.46, 0.56, 2.50, 0.56, 0.145, 0.125), 0.10);

  // HANGING (right) arm — the emotional hinge. Right shoulder → over
  // the front lip → down the FRONT face → wrist (scanned hand joins).
  d = smin(d, sdCapsule(px, py, pz, 0.40, 2.48, 0.20, 0.60, 2.40, 0.86, 0.16, 0.125), 0.12);
  d = smin(d, sdCapsule(px, py, pz, 0.60, 2.40, 0.86, 0.66, 1.74, 0.94, 0.125, 0.10), 0.08);
  return d;
}

// a bent cloth sheet on a Z-facing plane (front/back), wavy hem
function bentSheetZ(px, py, pz, x0, x1, yTop, yBot, Zfn, thick, seed) {
  let d = Math.abs(pz - Zfn(px, py)) - thick;
  d = smax(d, px - x1, 0.05); d = smax(d, x0 - px, 0.05);
  const hem = yBot + 0.12 * Math.sin(px * 3.0 + seed) + 0.05 * Math.sin(px * 7.3 + seed * 2);
  d = smax(d, hem - py, 0.06); d = smax(d, py - yTop, 0.06);
  return d;
}
// a bent cloth sheet on an X-facing plane (left/right side), wavy hem
function bentSheetX(px, py, pz, z0, z1, yTop, yBot, Xfn, thick, seed) {
  let d = Math.abs(px - Xfn(pz, py)) - thick;
  d = smax(d, pz - z1, 0.05); d = smax(d, z0 - pz, 0.05);
  const hem = yBot + 0.12 * Math.sin(pz * 3.0 + seed) + 0.05 * Math.sin(pz * 7.3 + seed * 2);
  d = smax(d, hem - py, 0.06); d = smax(d, py - yTop, 0.06);
  return d;
}

// garment cascading down the LEFT side and the BACK, pooling at base
function clothFall(px, py, pz) {
  // left curtain (under the wing), bowing out toward the ground
  const leftX = (z, y) => -PHW - 0.02 - 0.30 * clamp01((SLAB_Y - y) / 2.1) + 0.05 * Math.sin(z * 3.4);
  let d = bentSheetX(px, py, pz, -0.85, 0.9, 2.52, 0.05, leftX, 0.09, 0.6);
  // back curtain
  const backZ = (x, y) => -PHW - 0.02 - 0.28 * clamp01((SLAB_Y - y) / 2.1) + 0.05 * Math.sin(x * 3.6);
  d = smin(d, bentSheetZ(px, py, pz, -0.9, 0.55, 2.52, 0.05, backZ, 0.085, 2.0), 0.14);
  // gathered drapery pouring over the top-left corner
  d = smin(d, sdCapsule(px, py, pz, -0.55, 2.55, 0.10, -0.9, 2.2, 0.2, 0.2, 0.16), 0.16);
  // skirt pooling on the ground, left and back
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.5 + i / 6);           // left/back arc
    const x = -0.1 + Math.cos(a) * 1.0;
    const z = -0.25 + Math.sin(a) * 0.95;
    d = smin(d, sdCapsule(px, py, pz, x, 0.05, z, x * 0.9, 0.22 + 0.06 * Math.sin(i * 2.1), z * 0.9, 0.15, 0.11), 0.12);
  }
  return d;
}

// full shrouded figure with a three-level fold hierarchy
function figureSDF(px, py, pz) {
  const body = figureBase(px, py, pz);
  const cloth = clothFall(px, py, pz);
  let d = smin(body, cloth, 0.22);
  d = smax(d, -(py - 0.02), 0.03);              // rest on the ground

  // where the shroud hangs free (down the left side / off the back)
  const belowTop = clamp01((SLAB_Y - 0.05 - py) / 0.6);
  const hang = Math.max(
    clamp01((-0.55 - px) / 0.45) * belowTop,             // left fall
    clamp01((-0.6 - pz) / 0.45) * belowTop               // back fall
  );

  // PRIMARY folds: broad vertical gravity channels on the falls
  const warp = fbm(px * 1.1, py * 0.6, pz * 1.1) * 2.2;
  const g1 = Math.sin(px * 4.2 + pz * 2.6 + warp);
  const primary = Math.sign(g1) * Math.pow(Math.abs(g1), 0.85);
  // SECONDARY folds: finer, offset
  const g2 = Math.sin(px * 9.5 + pz * 5.0 + warp * 1.7 + 1.3);
  // TERTIARY crinkle + surface break
  const tert = (fbm(px * 7, py * 7, pz * 7) - 0.5);
  d += (0.052 * primary + 0.020 * g2 + 0.010 * tert) * hang;

  // taut drapery undulation over the body masses (above the lip)
  const taut = Math.sin(px * 6 + pz * 4.5 + warp * 1.3) * 0.012 * (1 - hang) * clamp01(py / 2.2);
  d += taut;

  // micro stone grain — tiny, preserves silhouette
  d += (fbm(px * 24, py * 24, pz * 24) - 0.5) * 0.0035;
  return d;
}

// ── SDF gradient normal ────────────────────────────────────────
function sdfNormal(f, px, py, pz, e) {
  const dx = f(px + e, py, pz) - f(px - e, py, pz);
  const dy = f(px, py + e, pz) - f(px, py - e, pz);
  const dz = f(px, py, pz + e) - f(px, py, pz - e);
  const l = Math.hypot(dx, dy, dz) || 1;
  return [dx / l, dy / l, dz / l];
}

// ── SDF ambient occlusion (marched along the normal) ───────────
function sdfAO(f, px, py, pz, nx, ny, nz) {
  let occ = 0, sca = 1;
  for (let i = 1; i <= 5; i++) {
    const h = 0.012 + 0.05 * i;
    const d = f(px + nx * h, py + ny * h, pz + nz * h);
    occ += (h - d) * sca;
    sca *= 0.72;
  }
  return clamp01(1 - 2.2 * occ);
}

// ═══ SURFACE NETS ═════════════════════════════════════════════
function surfaceNets(f, bbox, vox) {
  const [x0, y0, z0, x1, y1, z1] = bbox;
  const nx = Math.ceil((x1 - x0) / vox) + 1;
  const ny = Math.ceil((y1 - y0) / vox) + 1;
  const nz = Math.ceil((z1 - z0) / vox) + 1;
  console.log(`  grid ${nx}×${ny}×${nz} = ${(nx * ny * nz / 1e6).toFixed(1)}M`);
  const F = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  // sample field (plane by plane)
  for (let k = 0; k < nz; k++) {
    const z = z0 + k * vox;
    for (let j = 0; j < ny; j++) {
      const y = y0 + j * vox;
      const base = nx * (j + ny * k);
      for (let i = 0; i < nx; i++) F[base + i] = f(x0 + i * vox, y, z);
    }
  }

  const cornerOff = [[0,0,0],[1,0,0],[0,1,0],[1,1,0],[0,0,1],[1,0,1],[0,1,1],[1,1,1]];
  const edges = [[0,1],[0,2],[0,4],[1,3],[1,5],[2,3],[2,6],[3,7],[4,5],[4,6],[5,7],[6,7]];
  const vid = new Int32Array(nx * ny * nz).fill(-1);
  const pos = [];

  for (let k = 0; k < nz - 1; k++) {
    for (let j = 0; j < ny - 1; j++) {
      for (let i = 0; i < nx - 1; i++) {
        const g = [
          F[idx(i,j,k)], F[idx(i+1,j,k)], F[idx(i,j+1,k)], F[idx(i+1,j+1,k)],
          F[idx(i,j,k+1)], F[idx(i+1,j,k+1)], F[idx(i,j+1,k+1)], F[idx(i+1,j+1,k+1)],
        ];
        let mask = 0;
        for (let c = 0; c < 8; c++) if (g[c] < 0) mask |= 1 << c;
        if (mask === 0 || mask === 255) continue;
        let px = 0, py = 0, pz = 0, ec = 0;
        for (let e = 0; e < 12; e++) {
          const a = edges[e][0], b = edges[e][1];
          const va = g[a], vb = g[b];
          if ((va < 0) !== (vb < 0)) {
            const t = va / (va - vb);
            px += mix(cornerOff[a][0], cornerOff[b][0], t);
            py += mix(cornerOff[a][1], cornerOff[b][1], t);
            pz += mix(cornerOff[a][2], cornerOff[b][2], t);
            ec++;
          }
        }
        vid[idx(i,j,k)] = pos.length / 3;
        pos.push(x0 + (i + px / ec) * vox, y0 + (j + py / ec) * vox, z0 + (k + pz / ec) * vox);
      }
    }
  }

  // quads → triangles (winding fixed later by gradient)
  const tri = [];
  const emitQuad = (a, b, c, d) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    tri.push(a, b, d, a, d, c);
  };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const f0 = F[idx(i,j,k)];
        if (i < nx - 1 && j > 0 && k > 0) {
          const f1 = F[idx(i+1,j,k)];
          if ((f0 < 0) !== (f1 < 0))
            emitQuad(vid[idx(i,j-1,k-1)], vid[idx(i,j,k-1)], vid[idx(i,j-1,k)], vid[idx(i,j,k)]);
        }
        if (j < ny - 1 && i > 0 && k > 0) {
          const f1 = F[idx(i,j+1,k)];
          if ((f0 < 0) !== (f1 < 0))
            emitQuad(vid[idx(i-1,j,k-1)], vid[idx(i,j,k-1)], vid[idx(i-1,j,k)], vid[idx(i,j,k)]);
        }
        if (k < nz - 1 && i > 0 && j > 0) {
          const f1 = F[idx(i,j,k+1)];
          if ((f0 < 0) !== (f1 < 0))
            emitQuad(vid[idx(i-1,j-1,k)], vid[idx(i,j-1,k)], vid[idx(i-1,j,k)], vid[idx(i,j,k)]);
        }
      }
    }
  }

  // normals from SDF gradient; fix winding per triangle
  const V = pos.length / 3;
  const N = new Float32Array(pos.length);
  const e = vox * 0.6;
  for (let v = 0; v < V; v++) {
    const n = sdfNormal(f, pos[v*3], pos[v*3+1], pos[v*3+2], e);
    N[v*3] = n[0]; N[v*3+1] = n[1]; N[v*3+2] = n[2];
  }
  for (let t = 0; t < tri.length; t += 3) {
    const a = tri[t], b = tri[t+1], c = tri[t+2];
    const ux = pos[b*3]-pos[a*3], uy = pos[b*3+1]-pos[a*3+1], uz = pos[b*3+2]-pos[a*3+2];
    const wx = pos[c*3]-pos[a*3], wy = pos[c*3+1]-pos[a*3+1], wz = pos[c*3+2]-pos[a*3+2];
    const fnx = uy*wz-uz*wy, fny = uz*wx-ux*wz, fnz = ux*wy-uy*wx;
    const gnx = N[a*3]+N[b*3]+N[c*3], gny = N[a*3+1]+N[b*3+1]+N[c*3+1], gnz = N[a*3+2]+N[b*3+2]+N[c*3+2];
    if (fnx*gnx + fny*gny + fnz*gnz < 0) { tri[t+1] = c; tri[t+2] = b; }
  }

  console.log(`  ${V} verts, ${tri.length/3} tris`);
  return { pos: new Float32Array(pos), nor: N, tri: new Uint32Array(tri) };
}

// ── bake AO into vertex colors + mineral tint ──────────────────
function bakeColors(f, mesh, tintSeed, warmCavity = 1) {
  const V = mesh.pos.length / 3;
  const C = new Float32Array(V * 3);
  for (let v = 0; v < V; v++) {
    const x = mesh.pos[v*3], y = mesh.pos[v*3+1], z = mesh.pos[v*3+2];
    const nx = mesh.nor[v*3], ny = mesh.nor[v*3+1], nz = mesh.nor[v*3+2];
    let ao = sdfAO(f, x, y, z, nx, ny, nz);
    // ground contact darkening
    ao *= mix(0.7, 1, clamp01(y / 0.5));
    ao = clamp(ao, 0.34, 1);
    const drift = (fbm(x * 1.1 + tintSeed, y * 1.1, z * 1.1) - 0.5) * 0.09;
    const val = ao * (1 + drift * 0.5);
    C[v*3] = val;
    C[v*3+1] = val * (0.997 - 0.010 * (1 - ao) * warmCavity);
    C[v*3+2] = val * (0.988 - 0.030 * (1 - ao) * warmCavity);
  }
  mesh.col = C;
  return mesh;
}

// ═══ EXPORT ═══════════════════════════════════════════════════
async function main() {
  console.log(`sculpting figure (${MODE}, vox ${VOX}m)…`);
  const bbox = [-1.30, 0.0, -1.60, 1.05, 2.95, 1.15];
  const t0 = Date.now();
  const fig = surfaceNets(figureSDF, bbox, VOX);
  console.log(`  meshed in ${((Date.now()-t0)/1000).toFixed(1)}s`);
  bakeColors(figureSDF, fig, 5.0);

  // write raw mesh json for inspection tools / later assembly
  writeFileSync(`${REPO}/tools/.figure-${MODE}.json`, JSON.stringify({
    pos: Array.from(fig.pos), nor: Array.from(fig.nor),
    col: Array.from(fig.col), tri: Array.from(fig.tri),
  }));

  await MeshoptEncoder.ready;
  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene('figure');
  const prim = doc.createPrimitive();
  const mk = (arr, type) => doc.createAccessor().setType(type).setArray(arr).setBuffer(buf);
  prim.setAttribute('POSITION', mk(fig.pos, 'VEC3'));
  prim.setAttribute('NORMAL', mk(fig.nor, 'VEC3'));
  prim.setAttribute('COLOR_0', mk(fig.col, 'VEC3'));
  prim.setIndices(mk(fig.tri, 'SCALAR'));
  scene.addChild(doc.createNode('figure').setMesh(doc.createMesh('figure').addPrimitive(prim)));
  await doc.transform(reorder({ encoder: MeshoptEncoder }), prune());
  doc.createExtension(EXTMeshoptCompression).setRequired(true)
    .setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.FILTER });
  const io = new NodeIO().registerExtensions([EXTMeshoptCompression])
    .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });
  const glb = await io.writeBinary(doc);
  writeFileSync(`${REPO}/tools/.figure-${MODE}.glb`, glb);
  console.log(`  ${Math.round(glb.byteLength / 1024)} KB → tools/.figure-${MODE}.glb`);
}
main();
