// ═══════════════════════════════════════════════════════════════
// KATABASIS — world
// Six chambers, descending. Coordinates are metres; the surface
// is y = 0 and everything below is memory.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import {
  buildColumn, buildBrokenColumn, buildDrum, buildStairs, buildPlinth,
  buildVeiledFigure, buildArchitrave, buildRubble, buildPediment, scaleUV,
} from './builders.js';
import { makeGlowTexture, makeDust, makeRay, makePool } from './effects.js';
import { WingPair } from './wings.js';

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x070605, 0.03);
    this.chambers = [];         // { group, range:[a,b] }
    this.dusts = [];
    this.rays = [];
    this.veiled = [];           // { spot, base, pos: Vector3, boost }
    this.wingSpread = 0;
    this._spreadCurrent = -1;
    this.time = 0;
    this.glowTex = makeGlowTexture();
    this.buildSteps = [];       // [label, fn] — consumed by the loader
    this._plan();
  }

  // the loader executes these one per frame so the bar means something
  _plan() {
    this.buildSteps = [
      ['QUARRYING MARBLE',    () => { this.materials = createMaterials(this.renderer, this.quality); }],
      ['LAYING FOUNDATIONS',  () => this._buildFloors()],
      ['RAISING THE GATE',    () => this._buildThreshold()],
      ['RAISING FORTY COLUMNS', () => this._buildProcession()],
      ['SHROUDING THE GODS',  () => this._buildVeiled()],
      ['LETTING THE ROOF FALL', () => this._buildFallen()],
      ['FEATHERING THE WINGS', () => this._buildWinged()],
      ['WAKING THE DUST',     () => this._buildAtmosphere()],
    ];
  }

  _chamber(range) {
    const g = new THREE.Group();
    g.userData.range = range;
    this.scene.add(g);
    this.chambers.push(g);
    return g;
  }

  // ── floors, stairs, walls ────────────────────────────────────

  _buildFloors() {
    const { floor, stone } = this.materials;
    const mk = (w, d, x, y, z, group) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floor);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.receiveShadow = true;
      group.add(m);
      return m;
    };

    // chamber groups (progress ranges padded generously for visibility culling)
    this.gThreshold  = this._chamber([-0.1, 0.22]);
    this.gProcession = this._chamber([0.02, 0.40]);
    this.gVeiled     = this._chamber([0.28, 0.66]);
    this.gFallen     = this._chamber([0.54, 0.83]);
    this.gRotunda    = this._chamber([0.72, 1.1]);

    mk(60, 36, 0, 0, 18, this.gThreshold);                       // plaza — ends where the stair begins
    mk(26, 49.6, 0, -6, -39.2, this.gProcession);                // corridor
    mk(36, 43.2, 0, -13, -102.4, this.gVeiled);                  // veiled hall
    mk(44, 39.2, 0, -20, -160.4, this.gFallen);                  // fallen hall

    const rotFloor = new THREE.Mesh(new THREE.CircleGeometry(26, 64), floor);
    rotFloor.rotation.x = -Math.PI / 2;
    rotFloor.position.set(0, -24, -214);
    rotFloor.receiveShadow = true;
    this.gRotunda.add(rotFloor);

    // stairs
    const s1 = new THREE.Mesh(buildStairs({ width: 14, steps: 12, rise: 0.5, run: 1.2 }), stone);
    s1.position.set(0, 0, 0);
    this.gProcession.add(s1);

    const s2 = new THREE.Mesh(buildStairs({ width: 16, steps: 14, rise: 0.5, run: 1.2 }), stone);
    s2.position.set(0, -6, -64);
    this.gVeiled.add(s2);

    const s3 = new THREE.Mesh(buildStairs({ width: 14, steps: 14, rise: 0.5, run: 1.2 }), stone);
    s3.position.set(0, -13, -124);
    this.gFallen.add(s3);

    const s4 = new THREE.Mesh(buildStairs({ width: 10, steps: 8, rise: 0.5, run: 1.2 }), stone);
    s4.position.set(0, -20, -180);
    this.gRotunda.add(s4);

    // corridor walls — dark planes that swallow the light pools
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x121009, roughness: 0.95 });
    this.wallMat = wallMat;
    const mkWall = (w, h, x, y, z, ry, group) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      group.add(m);
    };
    mkWall(52, 18, -12.5, 2, -39.5, Math.PI / 2, this.gProcession);
    mkWall(52, 18, 12.5, 2, -39.5, -Math.PI / 2, this.gProcession);
    mkWall(38, 20, -17.5, -4, -102.5, Math.PI / 2, this.gVeiled);
    mkWall(38, 20, 17.5, -4, -102.5, -Math.PI / 2, this.gVeiled);
    mkWall(36, 16, 0, -5, -124.5, 0, this.gVeiled);              // hall end wall
    mkWall(46, 22, -21.5, -10, -160, Math.PI / 2, this.gFallen);
    mkWall(46, 22, 21.5, -10, -160, -Math.PI / 2, this.gFallen);

    // rotunda drum wall
    const drumGeo = new THREE.CylinderGeometry(25, 25, 52, 48, 1, true);
    const drum = new THREE.Mesh(drumGeo, new THREE.MeshStandardMaterial({
      color: 0x14110c, roughness: 0.92, side: THREE.BackSide,
    }));
    drum.position.set(0, 2, -214);
    this.gRotunda.add(drum);
  }

  // ── I · threshold ────────────────────────────────────────────

  _buildThreshold() {
    const { marble, stone } = this.materials;
    const colGeo = buildColumn({ height: 13, radius: 0.95 });
    this.columnGeo13 = colGeo;

    const gate = new THREE.Group();
    for (const x of [-5.4, 5.4]) {
      const c = new THREE.Mesh(colGeo, marble);
      c.position.set(x, 0, 0);
      c.castShadow = true;
      gate.add(c);
    }
    const arch = new THREE.Mesh(buildArchitrave({ length: 14.6, h: 1.5, d: 2.1 }), marble);
    arch.position.set(0, 13.1, 0);
    gate.add(arch);
    const ped = new THREE.Mesh(scaleUV(buildPediment({ width: 15, height: 3.0, depth: 1.9 }), 0.4, 0.4), stone);
    ped.position.set(0, 14.65, -0.95);
    gate.add(ped);
    this.gThreshold.add(gate);

    // a ruined colonnade leads across the plaza to the gate
    const stumps = [
      [-11, 6, 5.6, 11], [11, 7.5, 3.2, 12], [-11.5, 13.5, 8.4, 13],
      [11.5, 15, 6.0, 14], [-11, 20, 2.6, 15],
    ];
    for (const [x, z, h, seed] of stumps) {
      const m = new THREE.Mesh(buildBrokenColumn({ height: h, radius: 0.8, seed }), marble);
      m.position.set(x, 0, z);
      this.gThreshold.add(m);
    }
    const drum1 = new THREE.Mesh(buildDrum({ radius: 0.7, length: 2.2, seed: 12 }), marble);
    drum1.position.set(7.8, 0.66, 17.5);
    drum1.rotation.y = 0.7;
    this.gThreshold.add(drum1);

    // cold grazing light from high above the gate — carves the flutes
    const moon = new THREE.SpotLight(0x9fb4cf, 1500, 80, 0.34, 0.5, 1.3);
    moon.position.set(9, 30, 14);
    moon.target.position.set(0, 7.5, 0);
    this.gThreshold.add(moon, moon.target);

    // the descent glows through the doorway — a narrow warm rim, not a flood
    const beyond = new THREE.SpotLight(0xffe3ba, 700, 70, 0.34, 0.5, 1.5);
    beyond.position.set(0, 5, -12);
    beyond.target.position.set(0, 2.5, 16);
    this.gThreshold.add(beyond, beyond.target);

    // the doorway itself — a slot of dim warm haze
    const portal = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xffe0b0, transparent: true, opacity: 0.30,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    portal.scale.set(8, 12, 1);
    portal.position.set(0, 5.2, -7);
    this.gThreshold.add(portal);
    this.portalSprite = portal;

    // faint moonshaft over the gate
    const ray = makeRay({ topRadius: 0.9, bottomRadius: 5, height: 24, color: 0x9fb4cf, intensity: 0.10 });
    ray.position.set(0, 13, -3);
    this.gThreshold.add(ray);
    this.rays.push(ray);
  }

  // ── II · procession ──────────────────────────────────────────

  _buildProcession() {
    const { marble, floor } = this.materials;
    const colGeo = buildColumn({ height: 11, radius: 0.55 });
    this.columnGeo11 = colGeo;

    // forty columns: two files per side
    const positions = [];
    for (let i = 0; i < 10; i++) {
      const z = -18 - i * 4.9;
      positions.push([-5, z], [5, z], [-9.5, z], [9.5, z]);
    }
    const inst = new THREE.InstancedMesh(colGeo, marble, positions.length);
    const m = new THREE.Matrix4();
    positions.forEach(([x, z], i) => {
      m.makeRotationY((i % 7) * 0.9);                       // vary flute phase
      m.setPosition(x, -6, z);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    inst.castShadow = true;
    this.gProcession.add(inst);

    // rhythmic shafts of pale light between the columns
    const shaftZ = [-24, -38, -52];
    for (let i = 0; i < shaftZ.length; i++) {
      const z = shaftZ[i];
      const spot = new THREE.SpotLight(0xcdd8e4, 620, 45, 0.42, 0.6, 1.4);
      spot.position.set(i % 2 ? 3 : -3, 10, z);
      spot.target.position.set(i % 2 ? -1 : 1, -6, z - 1);
      this.gProcession.add(spot, spot.target);

      const ray = makeRay({ topRadius: 0.5, bottomRadius: 3.4, height: 17, color: 0xb9c6d6, intensity: 0.20 });
      ray.position.set(i % 2 ? 2 : -2, 2, z);
      ray.rotation.z = (i % 2 ? -1 : 1) * 0.12;
      this.gProcession.add(ray);
      this.rays.push(ray);

      const pool = makePool({ radius: 3.4, color: 0x9fb0c4, opacity: 0.10, map: this.glowTex });
      pool.position.set(i % 2 ? 1.4 : -1.4, -5.96, z - 0.8);
      this.gProcession.add(pool);
    }

    // a faint warm memory at the far end, pulling you forward
    const lure = new THREE.PointLight(0xffd9a8, 45, 34, 1.5);
    lure.position.set(0, -5, -71);
    this.gProcession.add(lure);
  }

  // ── III · the veiled ─────────────────────────────────────────

  _buildVeiled() {
    const { marble, shroud } = this.materials;
    const plinthGeo = buildPlinth({ w: 2.4, h: 1.6, d: 2.4 });

    const figures = [
      { pos: [-6, -92],  pose: 'witness', h: 3.8, seed: 5,  rot: 0.35 },
      { pos: [6, -103],  pose: 'orant',   h: 3.5, seed: 8,  rot: -0.45 },
      { pos: [0, -117],  pose: 'mourner', h: 3.3, seed: 13, rot: 0.05 },
    ];

    for (const f of figures) {
      const [x, z] = f.pos;
      const plinth = new THREE.Mesh(plinthGeo, marble);
      plinth.position.set(x, -13, z);
      plinth.castShadow = true;
      plinth.receiveShadow = true;
      this.gVeiled.add(plinth);

      const fig = new THREE.Mesh(buildVeiledFigure({ height: f.h, seed: f.seed, pose: f.pose }), shroud);
      fig.position.set(x, -11.4, z);
      fig.rotation.y = f.rot + Math.PI;                    // face the path (bow toward +z)
      fig.castShadow = true;
      this.gVeiled.add(fig);

      // votive spot per figure
      const spot = new THREE.SpotLight(0xffe6c2, 500, 34, 0.42, 0.7, 1.5);
      spot.position.set(x + 2.5, -2.5, z + 4.5);
      spot.target.position.set(x, -11, z);
      spot.castShadow = this.quality.shadows;
      if (spot.castShadow) {
        spot.shadow.mapSize.set(512, 512);
        spot.shadow.bias = -0.002;
      }
      this.gVeiled.add(spot, spot.target);
      this.veiled.push({ spot, base: 500, pos: new THREE.Vector3(x, -9.5, z), boost: 0 });

      const ray = makeRay({ topRadius: 0.4, bottomRadius: 2.6, height: 12, color: 0xffe0b8, intensity: 0.14 });
      ray.position.set(x + 1.1, -7, z + 2);
      ray.rotation.z = -0.18;
      this.gVeiled.add(ray);
      this.rays.push(ray);

      const pool = makePool({ radius: 4.2, color: 0xffd9a8, opacity: 0.11, map: this.glowTex });
      pool.position.set(x, -12.96, z + 0.5);
      this.gVeiled.add(pool);

      const rim = new THREE.PointLight(0x9db4d4, 42, 16, 1.7);
      rim.position.set(x - 1.5, -7.5, z - 3.5);
      this.gVeiled.add(rim);
    }

    // a broad dim wash so the hall floor exists at all
    const wash = new THREE.SpotLight(0x8b94a3, 720, 60, 0.95, 0.9, 1.6);
    wash.position.set(0, 2, -101);
    wash.target.position.set(0, -13, -102);
    this.gVeiled.add(wash, wash.target);

    // a pale shaft over the stair down into the hall
    const stairGlow = new THREE.SpotLight(0xaebccd, 320, 40, 0.5, 0.65, 1.4);
    stairGlow.position.set(4, -1, -71);
    stairGlow.target.position.set(-1, -11, -78);
    this.gVeiled.add(stairGlow, stairGlow.target);

    const stairRay = makeRay({ topRadius: 0.5, bottomRadius: 3.0, height: 12, color: 0xaebccd, intensity: 0.09 });
    stairRay.position.set(2, -3.5, -73);
    stairRay.rotation.z = -0.22;
    this.gVeiled.add(stairRay);
    this.rays.push(stairRay);

    // cold counter-light from the hall's far end
    const counter = new THREE.SpotLight(0x8fa3bd, 80, 70, 0.55, 0.8, 1.4);
    counter.position.set(0, -2, -127);
    counter.target.position.set(0, -8, -98);
    this.gVeiled.add(counter, counter.target);
  }

  // ── IV · the fallen ──────────────────────────────────────────

  _buildFallen() {
    const { marble, stone } = this.materials;

    // standing stumps
    const stumps = [
      { x: -8, z: -146, h: 6.5, seed: 21, r: 0.62 },
      { x: 7.5, z: -152, h: 3.4, seed: 22, r: 0.62 },
      { x: -6.5, z: -166, h: 9.0, seed: 23, r: 0.62 },
      { x: 9, z: -170, h: 5.2, seed: 24, r: 0.62 },
    ];
    for (const s of stumps) {
      const mesh = new THREE.Mesh(buildBrokenColumn({ height: s.h, radius: s.r, seed: s.seed }), marble);
      mesh.position.set(s.x, -20, s.z);
      mesh.castShadow = true;
      this.gFallen.add(mesh);
    }

    // fallen drums — a column dismembered along its line of collapse
    const drumGeo = buildDrum({ radius: 0.62, length: 1.9, seed: 31 });
    const drops = [
      [-1.5, -148, 0.15], [0.8, -150.5, 0.55], [3.0, -153.5, 0.95],
      [4.8, -157, 1.35], [2.2, -161, 2.1], [-2.5, -158.5, -0.4],
    ];
    drops.forEach(([x, z, ry], i) => {
      const d = new THREE.Mesh(drumGeo, marble);
      d.position.set(x, -19.35, z);
      d.rotation.y = ry;
      d.rotation.x = (i % 3) * 0.05;
      d.castShadow = true;
      this.gFallen.add(d);
    });

    // collapsed pediment leaning against the dark
    const ped = new THREE.Mesh(scaleUV(buildPediment({ width: 11, height: 2.6, depth: 1.2 }), 0.4, 0.4), stone);
    ped.position.set(-11, -19.9, -172);
    ped.rotation.set(-0.28, 0.5, 0.12);
    this.gFallen.add(ped);

    // architrave beam, one end on the ground, aligned with the line of collapse
    const beam = new THREE.Mesh(buildArchitrave({ length: 9, h: 1.1, d: 1.1 }), stone);
    beam.position.set(8.6, -19.55, -168.5);
    beam.rotation.set(0.04, 1.22, -0.1);
    beam.castShadow = true;
    this.gFallen.add(beam);

    // rubble
    const rubbleMat = stone.clone();
    rubbleMat.color.setHex(0x5e594f);
    const rubble = new THREE.Mesh(buildRubble({ count: this.quality.rubble, area: 14, seed: 3 }), rubbleMat);
    rubble.position.set(0.5, -20, -159);
    rubble.receiveShadow = true;
    this.gFallen.add(rubble);

    // a dying glow over the stair into the ruin
    const stairGlow2 = new THREE.SpotLight(0xc7b391, 420, 40, 0.5, 0.7, 1.4);
    stairGlow2.position.set(-4, -8, -130);
    stairGlow2.target.position.set(1, -18, -137);
    this.gFallen.add(stairGlow2, stairGlow2.target);

    // the oculus — one wound of light in the ceiling
    const oculus = new THREE.SpotLight(0xbfcbdb, 1050, 80, 0.17, 0.45, 1.3);
    oculus.position.set(0, 8, -160);
    oculus.target.position.set(0.5, -20, -161);
    oculus.castShadow = this.quality.shadows;
    if (oculus.castShadow) {
      oculus.shadow.mapSize.set(1024, 1024);
      oculus.shadow.bias = -0.0015;
    }
    this.gFallen.add(oculus, oculus.target);

    const shaft = makeRay({ topRadius: 0.8, bottomRadius: 4.4, height: 28, color: 0xacbccf, intensity: 0.44 });
    shaft.position.set(0.3, -7, -160.5);
    this.gFallen.add(shaft);
    this.rays.push(shaft);

    const pool = makePool({ radius: 4.6, color: 0x9fb0c4, opacity: 0.12, map: this.glowTex });
    pool.position.set(0.5, -19.94, -161);
    this.gFallen.add(pool);
  }

  // ── V · the winged one ───────────────────────────────────────

  _buildWinged() {
    const { marble, shroud } = this.materials;

    // ring of columns
    const ringGeo = buildColumn({ height: 17, radius: 0.85 });
    const ringCount = 14;
    const slots = [];
    for (let i = 0; i < ringCount; i++) {
      const a = (i / ringCount) * Math.PI * 2 + Math.PI / ringCount;
      const x = Math.cos(a) * 21, z = -214 + Math.sin(a) * 21;
      if (Math.abs(x) < 5 && z > -214) continue;           // leave the entrance open
      slots.push([a, x, z]);
    }
    const ring = new THREE.InstancedMesh(ringGeo, marble, slots.length);
    const m = new THREE.Matrix4();
    slots.forEach(([a, x, z], i) => {
      m.makeRotationY(a);
      m.setPosition(x, -24, z);
      ring.setMatrixAt(i, m);
    });
    ring.instanceMatrix.needsUpdate = true;
    this.gRotunda.add(ring);

    // the colossus
    const plinth = new THREE.Mesh(buildPlinth({ w: 5.2, h: 4.2, d: 5.2 }), marble);
    plinth.position.set(0, -24, -214);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.gRotunda.add(plinth);

    const fig = new THREE.Mesh(
      buildVeiledFigure({ height: 7.6, seed: 40, pose: 'ascendant' }),
      shroud
    );
    fig.position.set(0, -19.8, -214);
    fig.rotation.y = Math.PI;                              // face the entrance
    fig.castShadow = true;
    this.gRotunda.add(fig);
    this.colossus = fig;

    // wings — one carved surface per side, two layers each
    const wingMat = shroud.clone();
    wingMat.side = THREE.DoubleSide;
    this.wingPair = new WingPair(wingMat, 10.5);
    this.wingPair.group.position.set(0, -15.2, -214.9);    // shoulder blades
    this.gRotunda.add(this.wingPair.group);

    // light rig: cold rim from behind, warm devotion from the front
    const back = new THREE.SpotLight(0xa8bcd8, 1600, 46, 0.5, 0.55, 1.3);
    back.position.set(0, -6, -238);
    back.target.position.set(0, -16, -212);
    this.gRotunda.add(back, back.target);
    this.wingedBack = back;

    const key = new THREE.SpotLight(0xffdfae, 720, 80, 0.30, 0.7, 1.4);
    key.position.set(11, -4, -196);
    key.target.position.set(0, -13, -214);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(1024, 1024);
      key.shadow.bias = -0.0015;
    }
    this.gRotunda.add(key, key.target);
    this.wingedKey = key;

    // the oculus far above — the way out
    const oculusGlow = new THREE.PointLight(0xf3ead6, 300, 100, 1.2);
    oculusGlow.position.set(0, 22, -214);
    this.gRotunda.add(oculusGlow);
    this.oculusGlow = oculusGlow;

    const shaft = makeRay({ topRadius: 1.6, bottomRadius: 7.5, height: 46, color: 0xd8cdb4, intensity: 0.20 });
    shaft.position.set(0, 0, -214);
    this.gRotunda.add(shaft);
    this.rays.push(shaft);
    this.finalShaft = shaft;

    // bright disc of the oculus itself
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 48),
      new THREE.MeshBasicMaterial({ color: 0xfff6e2, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    disc.position.set(0, 24, -214);
    disc.rotation.x = Math.PI / 2;
    this.gRotunda.add(disc);
    this.oculusDisc = disc;

    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.glowTex, color: 0xfff2d8, transparent: true, opacity: 0.55,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(14, 14, 1);
    halo.position.set(0, 23, -214);
    this.gRotunda.add(halo);
    this.halo = halo;

    const pool = makePool({ radius: 7, color: 0xe8d9b8, opacity: 0.06, map: this.glowTex });
    pool.position.set(0, -23.94, -214);
    this.gRotunda.add(pool);
  }

  // ── atmosphere ───────────────────────────────────────────────

  _buildAtmosphere() {
    const q = this.quality.dustScale;
    const add = (opts, group) => {
      const d = makeDust({ ...opts, count: Math.round(opts.count * q), map: this.glowTex });
      group.add(d);
      this.dusts.push(d);
    };
    add({ count: 220, box: [30, 16, 34], center: [0, 6, 8], opacity: 0.4 }, this.gThreshold);
    add({ count: 260, box: [18, 12, 50], center: [0, 0, -39], opacity: 0.45 }, this.gProcession);
    add({ count: 260, box: [30, 10, 44], center: [0, -8, -102], opacity: 0.4 }, this.gVeiled);
    add({ count: 300, box: [36, 14, 42], center: [0, -14, -159], opacity: 0.5 }, this.gFallen);
    add({ count: 420, box: [40, 34, 44], center: [0, -8, -214], opacity: 0.5 }, this.gRotunda);

    // ambient — barely there, so the dark stays honest
    this.scene.add(new THREE.HemisphereLight(0x2a3040, 0x0d0a07, 0.65));

    // the carried lantern (driven from main)
    this.lantern = new THREE.PointLight(0xffe4c0, 26, 24, 1.7);
    this.scene.add(this.lantern);
  }

  // ── wings ────────────────────────────────────────────────────

  setWingSpread(v) {
    this.wingSpread = THREE.MathUtils.clamp(v, 0, 1);
    if (this.wingPair && this.gRotunda.visible) this.wingPair.setSpread(this.wingSpread);
  }

  // ── per-frame ────────────────────────────────────────────────

  update(progress, time, dt, cameraPos) {
    this.time = time;

    // chamber culling
    for (const g of this.chambers) {
      const [a, b] = g.userData.range;
      g.visible = progress >= a && progress <= b;
    }

    // the doorway haze dims once you are through it
    if (this.portalSprite) {
      this.portalSprite.material.opacity = 0.30 * (1 - THREE.MathUtils.smoothstep(progress, 0.03, 0.085));
    }

    // fog breathes with depth: thick in the middle passages, thin in the rotunda
    const fogKeys = [
      [0.00, 0.024], [0.15, 0.034], [0.40, 0.030], [0.62, 0.034],
      [0.78, 0.018], [0.93, 0.012], [1.00, 0.008],
    ];
    this.scene.fog.density = sampleKeys(fogKeys, progress);

    // effects time
    for (const d of this.dusts) if (d.parent.visible) d.material.uniforms.uTime.value = time;
    for (const r of this.rays) if (r.parent.visible) r.material.uniforms.uTime.value = time;

    // votive swells
    for (const vfig of this.veiled) {
      vfig.spot.intensity += ((vfig.base * (1 + vfig.boost * 1.6)) - vfig.spot.intensity) * Math.min(1, dt * 3);
    }

    // wing reveal — driven by approach through the rotunda
    const spread = THREE.MathUtils.smoothstep(progress, 0.775, 0.875);
    this.setWingSpread(spread);

    // finale: the oculus opens and the world above burns white
    if (this.oculusGlow) {
      const asc = THREE.MathUtils.smoothstep(progress, 0.93, 1.0);
      this.oculusGlow.intensity = 300 + asc * 2600;
      this.finalShaft.material.uniforms.uIntensity.value = 0.20 + asc * 0.55;
      if (this.wingedBack) this.wingedBack.intensity = 1600 * (1 - asc * 0.6);
      if (this.halo) {
        this.halo.scale.set(14 + asc * 46, 14 + asc * 46, 1);
        this.halo.material.opacity = 0.55 + asc * 0.4;
      }
      if (this.oculusDisc) this.oculusDisc.scale.setScalar(1 + asc * 2.2);
    }
  }
}

function sampleKeys(keys, t) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1];
      const [t1, v1] = keys[i];
      const f = (t - t0) / (t1 - t0);
      return v0 + (v1 - v0) * f;
    }
  }
  return keys[keys.length - 1][1];
}
