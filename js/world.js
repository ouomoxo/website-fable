// ═══════════════════════════════════════════════════════════════
// ANAMNESIS — world
// Five movements, descending: a colonnade, a stair, a separated
// face, a wing, and a hall where fragments agree from one point.
// Coordinates are metres; y = 0 is the surface.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { buildStairs, buildPlinth, buildColumn, scaleUV } from './builders.js';
import { makeGlowTexture, makeDust, makeRay } from './effects.js';
import { buildWingFragment } from './wings.js';
import { loadSculptures, sliceFigure, bakePigment } from './assets.js';

const V3 = THREE.Vector3;

export class World {
  constructor(renderer, quality) {
    this.renderer = renderer;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060504);
    this.scene.fog = new THREE.FogExp2(0x080606, 0.02);
    this.chambers = [];
    this.dusts = [];
    this.rays = [];
    this.veiled = [];           // { spot, base, pos, boost } — attention light
    this.time = 0;
    this.glowTex = makeGlowTexture();
    this.buildSteps = [];
    this._plan();
  }

  _plan() {
    this.buildSteps = [
      (onProgress) => loadSculptures(this.quality.assetTier, onProgress)
        .then((models) => { this.models = models; }),
      () => { this.materials = createMaterials(this.renderer, this.quality); },
      () => this._buildThreshold(),
      () => this._buildStair(),
      () => this._buildFace(),
      () => this._buildWing(),
      () => this._buildHall(),
      () => this._buildAtmosphere(),
    ];
  }

  _chamber(range) {
    const g = new THREE.Group();
    g.userData.range = range;
    this.scene.add(g);
    this.chambers.push(g);
    return g;
  }

  _box(w, h, d, x, y, z, mat, group, { ry = 0, cast = false, receive = true, uv = null } = {}) {
    let geo = new THREE.BoxGeometry(w, h, d);
    if (uv) geo = scaleUV(geo, uv[0], uv[1]);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.castShadow = cast;
    m.receiveShadow = receive;
    group.add(m);
    return m;
  }

  _floor(w, d, x, y, z, mat, group) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  }

  // a light shaft with a body, aimed from a source to a target
  _shaft(group, from, to, r0, r1, color, intensity) {
    const dir = new V3().subVectors(to, from);
    const len = dir.length();
    const ray = makeRay({ topRadius: r0, bottomRadius: r1, height: len, color, intensity });
    ray.position.copy(from).addScaledVector(dir, 0.5);
    ray.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir.normalize().negate());
    group.add(ray);
    this.rays.push(ray);
    return ray;
  }

  // a narrow emissive opening — the visible source of a light
  _slit(group, w, h, x, y, z, ry, color = 0xf3e2c2, opacity = 1) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, fog: false })
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
    return m;
  }

  // ── I · threshold — a colonnade at the edge of the dark ──────
  //     Light enters from an unseen opening at the left. Most of
  //     the architecture stays in shadow; the frame implies the
  //     rest. Between two piers, the stair goes down.

  _buildThreshold() {
    const { wall, floor, marble, scan } = this.materials;
    const g = this.gThreshold = this._chamber([-0.1, 0.30]);

    // one broad, dark, matte floor
    this._floor(90, 64, 0, 0, 18, floor, g);

    // the colonnade — two files, camera walks between them.
    // Nothing is shown complete: near shafts crop against the
    // frame, far ones dissolve into darkness.
    const colGeo = buildColumn({ height: 16, radius: 1.35, seed: 3 });
    const place = (x, z, ry = 0) => {
      const c = new THREE.Mesh(colGeo, marble);
      c.position.set(x, 0, z);
      c.rotation.y = ry;
      c.castShadow = true;
      c.receiveShadow = true;
      g.add(c);
      return c;
    };
    // right file — the near one is the foreground mass
    place(8.2, 24, 0.4);
    place(8.2, 8, 1.2);
    place(8.2, -8, 2.1);
    // left file — receding rhythm toward the light
    place(-7.2, 16, 1.05);
    place(-7.2, 0, 1.7);
    place(-7.2, -16, 2.9);

    // fragmented entablature over the files, dissolving upward
    this._box(4.2, 2.2, 28, -7.2, 16 + 1.1, 10, wall, g, { cast: true, uv: [1, 3] });
    this._box(4.2, 2.2, 20, 8.2, 16 + 1.1, 14, wall, g, { cast: true, uv: [1, 2.4] });

    // a broken face set into the dark between the far columns —
    // grounded on a low plinth, discovered rather than shown
    const plinth = new THREE.Mesh(buildPlinth({ w: 2.2, h: 0.9, d: 2.2 }), marble);
    plinth.position.set(-11.4, 0, -8);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);
    const relic = new THREE.Mesh(this.models.igea, scan);
    relic.scale.setScalar(2.1);
    relic.position.set(-11.4, 0.88, -8);
    relic.rotation.y = 1.35;                           // profile to the passage
    relic.castShadow = true;
    relic.receiveShadow = true;
    g.add(relic);

    // the piers of the threshold — dressed marble monoliths; the
    // dark between them is where the journey goes. Their stone is
    // honed smoother than the shafts, so grazing light stays calm.
    const pierMat = marble.clone();
    pierMat.bumpScale = 0.1;
    const pierL = this._box(3.4, 15, 3.0, -4.4, 7.5, -10.4, pierMat, g, { cast: true, uv: [1.1, 1.1] });
    const pierR = this._box(3.4, 15, 3.0, 4.4, 7.5, -10.4, pierMat, g, { cast: true, uv: [1.1, 1.1] });
    pierL.rotation.y = 0.04;
    pierR.rotation.y = -0.05;

    // key: daylight from an opening beyond the left colonnade —
    // one wide, soft, warm-neutral source raking across the shafts
    const key = new THREE.SpotLight(0xe9e0cd, 1600, 120, 0.55, 0.9, 1.5);
    key.position.set(-38, 22, 14);
    key.target.position.set(12, 0, 4);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0018;
      key.shadow.normalBias = 0.05;
    }
    g.add(key, key.target);

    // cool-neutral return from the stone overhead — keeps midtones
    const fill = new THREE.HemisphereLight(0x3c3b38, 0x16120e, 0.3);
    g.add(fill);

    // warm-black lift on the shadow side, so darkness stays material
    const lift = new THREE.PointLight(0x413a30, 40, 40, 1.7);
    lift.position.set(16, 6, 26);
    g.add(lift);

    // a faint presence from the dark beyond the piers
    const beyond = new THREE.PointLight(0x4c4a44, 14, 24, 1.8);
    beyond.position.set(0, 3, -20);
    g.add(beyond);
  }

  // ── II · the stair — a slot of darkness, one blade of light ──

  _buildStair() {
    const { wall, stone, floor } = this.materials;
    const g = this.gStair = this._chamber([0.16, 0.48]);

    // 24 steps: y 0 → -12, z -10 → -46
    const stair = new THREE.Mesh(buildStairs({ width: 6.4, steps: 24, rise: 0.5, run: 1.5 }), stone);
    stair.position.set(0, 0, -10);
    stair.receiveShadow = true;
    g.add(stair);

    // landing at the bottom, meeting the hall
    this._floor(6.4, 6, 0, -12, -49, floor, g);

    // flanking walls — the slot
    this._box(2.2, 30, 42, -4.3, 1, -29, wall, g, { uv: [3, 2.4] });
    this._box(2.2, 30, 42, 4.3, 1, -29, wall, g, { uv: [3, 2.4] });

    // one blade of light crossing the stair from a high slit
    const blade = new THREE.SpotLight(0xe9d9ba, 380, 40, 0.17, 0.45, 1.4);
    blade.position.set(-3.4, 9, -27);
    blade.target.position.set(3.2, -7.5, -31.5);
    blade.castShadow = this.quality.shadows;
    if (blade.castShadow) {
      blade.shadow.mapSize.set(512, 512);
      blade.shadow.bias = -0.002;
      blade.shadow.normalBias = 0.04;
    }
    g.add(blade, blade.target);

    this._slit(g, 3.2, 0.55, -3.15, 9, -27, Math.PI / 2, 0xcdb48c);
    this._shaft(g, new V3(-3.2, 8.8, -27), new V3(3.2, -7.5, -31.5), 0.5, 2.6, 0xe6d5b4, 0.16);

    // faint pull of light from the hall below
    const pull = new THREE.PointLight(0xcfc2a8, 48, 32, 1.7);
    pull.position.set(0, -10, -54);
    g.add(pull);
  }

  // ── III · the face — a goddess's head, one window ────────────

  _buildFace() {
    const { wall, floor, marble, scan } = this.materials;
    const g = this.gVeiled = this._chamber([0.28, 0.74]);

    // hall: floor y -12, z -46 → -94
    this._floor(34, 50, 0, -12, -70, floor, g);
    this._box(2.5, 24, 50, -17.2, -1, -70, wall, g, { uv: [4, 2] });
    this._box(2.5, 24, 50, 17.2, -1, -70, wall, g, { uv: [4, 2] });
    // end wall with a doorway through to the wing room
    this._box(14.6, 24, 2.5, -9.7, -1, -95.2, wall, g, { uv: [1.6, 2] });
    this._box(14.6, 24, 2.5, 9.7, -1, -95.2, wall, g, { uv: [1.6, 2] });
    this._box(4.8, 12, 2.5, 0, 5, -95.2, wall, g, { uv: [0.6, 1.2] });

    // the head — monumental, over twice life size
    const plinth = new THREE.Mesh(buildPlinth({ w: 2.6, h: 1.5, d: 2.6 }), marble);
    plinth.position.set(5, -12, -72);
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    g.add(plinth);

    const head = new THREE.Mesh(this.models.igea, scan);
    head.scale.setScalar(2.7);
    head.position.set(5, -10.52, -72);
    head.rotation.y = -0.55;                           // turned toward the window light
    head.castShadow = true;
    head.receiveShadow = true;
    g.add(head);

    // key: one high window on the left wall, raking across the figure
    const key = new THREE.SpotLight(0xf2e4c8, 520, 60, 0.165, 0.5, 1.35);
    key.position.set(-14.5, 8, -65);
    key.target.position.set(5, -8.5, -72);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.0015;
      key.shadow.normalBias = 0.05;
    }
    g.add(key, key.target);
    this.veiled.push({ spot: key, base: 520, pos: new V3(5, -9.2, -72), boost: 0 });
    this.faceKey = key;

    // the window itself, and the body of its light — both wake with
    // the reveal: the room is first read as darkness and a rim
    this.faceSlit = this._slit(g, 1.3, 6.5, -15.9, 7, -65.5, Math.PI / 2, 0xd4bd96, 0.999);
    this.faceSlit.material.transparent = true;
    this.faceShaft = this._shaft(g, new V3(-14.5, 7.5, -65), new V3(4, -11, -71.5), 0.9, 4.6, 0xe8dcc2, 0.22);

    // sparse dust, alive only inside the shaft
    this.dustVeiled = { center: [-5, -2, -68.5], box: [8, 14, 5] };

    // cool rim from behind-right, separating her from the dark
    const rim = new THREE.SpotLight(0x7e8ea6, 220, 18, 0.14, 0.65, 1.5);
    rim.position.set(13, -3, -84);
    rim.target.position.set(5, -9.2, -72);
    g.add(rim, rim.target);

    // bounce off the floor pool — soft, warm, from below
    const fbounce = new THREE.PointLight(0xd9c8a8, 9, 9, 1.8);
    fbounce.position.set(3.5, -10.5, -70);
    g.add(fbounce);
    this.faceBounce = fbounce;

    // the far wall barely exists — enough to keep the dark material
    const wash = new THREE.SpotLight(0x3d4450, 220, 50, 0.9, 0.9, 1.7);
    wash.position.set(-8, 4, -70);
    wash.target.position.set(4, -8, -94);
    g.add(wash, wash.target);
  }

  // ── IV · the wing — a fragment under raking light ────────────

  _buildWing() {
    const { wall, floor, marble } = this.materials;
    const g = this.gWing = this._chamber([0.665, 0.90]);

    // passage from the hall, then a smaller room: z -94 → -124
    this._floor(20, 32, 0, -12, -110, floor, g);
    this._box(2.4, 20, 32, -10.2, -3, -110, wall, g, { uv: [3, 2] });
    this._box(2.4, 20, 32, 10.2, -3, -110, wall, g, { uv: [3, 2] });
    // end wall with the doorway down to the rotunda
    this._box(6.9, 20, 2.4, -6.75, -3, -125.2, wall, g, { uv: [0.9, 2] });
    this._box(6.9, 20, 2.4, 6.75, -3, -125.2, wall, g, { uv: [0.9, 2] });
    this._box(6.6, 9, 2.4, 0, 2.5, -125.2, wall, g, { uv: [0.8, 1] });

    // low slab plinth
    const slab = new THREE.Mesh(buildPlinth({ w: 6.0, h: 1.0, d: 2.6 }), marble);
    slab.position.set(-0.5, -12, -112);
    slab.castShadow = true;
    slab.receiveShadow = true;
    g.add(slab);

    // the wing — upright, root resting on the slab, tip rising
    const wingMat = marble.clone();
    wingMat.side = THREE.DoubleSide;
    wingMat.bumpScale = 0.4;
    const wing = buildWingFragment(wingMat, { scale: 6.0, spread: 0.82, side: 1 });
    wing.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wing.position.set(-2.4, -11.0, -112);
    wing.rotation.z = 0.62;                            // tip lifted
    wing.rotation.y = -0.35;                           // turned slightly toward the camera
    g.add(wing);

    // raking light from a low slit in the right wall — grazes the feathers
    const rake = new THREE.SpotLight(0xf3e3c4, 290, 40, 0.40, 0.6, 1.4);
    rake.position.set(8.6, -9.2, -106);
    rake.target.position.set(-2, -8.8, -112.5);
    rake.castShadow = this.quality.shadows;
    if (rake.castShadow) {
      rake.shadow.mapSize.set(1024, 1024);
      rake.shadow.bias = -0.002;
      rake.shadow.normalBias = 0.04;
    }
    g.add(rake, rake.target);
    this._slit(g, 4.4, 0.7, 8.95, -9.2, -106, -Math.PI / 2, 0xcdb48c);

    // dim cool fill so the room reads at all
    const fill = new THREE.SpotLight(0x6f7c92, 170, 50, 0.9, 0.9, 1.6);
    fill.position.set(-6, 4, -100);
    fill.target.position.set(0, -10, -112);
    g.add(fill, fill.target);
  }

  // ── IV–V · the agreement hall ────────────────────────────────
  //   The winged figure is never present as one object. Its
  //   fragments stand on separate armatures at different depths,
  //   each scaled about one privileged camera position (CSTAR).
  //   From that point — and only from that point — they agree
  //   into a single body. Everywhere else they are archaeology.

  _buildHall() {
    const { wall, floor, marble, makeFragmentStone } = this.materials;
    const g = this.gHall = this._chamber([0.845, 1.1]);

    // descent passage: stair z -124 → -136, y -12 → -18
    const stair = new THREE.Mesh(buildStairs({ width: 6.4, steps: 12, rise: 0.5, run: 1.0 }), this.materials.stone);
    stair.position.set(0, -12, -124);
    stair.receiveShadow = true;
    g.add(stair);
    this._box(2.2, 18, 16, -4.3, -10, -130, wall, g, { uv: [1.6, 1.6] });
    this._box(2.2, 18, 16, 4.3, -10, -130, wall, g, { uv: [1.6, 1.6] });

    // the hall: long, dark, walls dissolving upward
    this._floor(46, 60, 0, -18, -166, floor, g);
    this._box(2.6, 30, 60, -23, -4, -166, wall, g, { uv: [5, 2.4] });
    this._box(2.6, 30, 60, 23, -4, -166, wall, g, { uv: [5, 2.4] });
    // far wall with one narrow slot of neutral daylight
    this._box(20.4, 30, 2.6, -12.6, -4, -195, wall, g, { uv: [2, 2.4] });
    this._box(20.4, 30, 2.6, 12.6, -4, -195, wall, g, { uv: [2, 2.4] });
    this._box(4.8, 17, 2.6, 0, 9.5, -195, wall, g, { uv: [0.5, 1.6] });
    this._box(1.3, 25, 2.6, -1.85, -5.5, -195, wall, g, { uv: [0.2, 2] });
    this._box(1.3, 25, 2.6, 1.85, -5.5, -195, wall, g, { uv: [0.2, 2] });
    this._slit(g, 2.4, 13, 0, -11.5, -195.5, 0, 0x6b6960);
    const daylight = new THREE.SpotLight(0x99968c, 300, 70, 0.55, 0.9, 1.6);
    daylight.position.set(0, -8, -199);
    daylight.target.position.set(0, -14, -160);
    g.add(daylight, daylight.target);

    // two columns flank the wings from the privileged point
    const colGeo = buildColumn({ height: 17, radius: 1.15, seed: 8 });
    for (const [x, z, ry] of [[-7.9, -176, 1.9], [8.1, -177, 0.7]]) {
      const c = new THREE.Mesh(colGeo, marble);
      c.position.set(x, -18, z);
      c.rotation.y = ry;
      c.castShadow = true;
      c.receiveShadow = true;
      g.add(c);
    }
    // an entablature fragment crosses above the composition
    this._box(3.8, 2.0, 12, 0.5, -3.4, -172, wall, g, { cast: true, uv: [1, 2] });

    // ── the fragments ─────────────────────────────────────────
    // CSTAR is the privileged eye. P0 is where the complete figure
    // would stand if it existed. Each fragment is scaled about
    // CSTAR by its own factor k, so it keeps its projection from
    // CSTAR while standing somewhere else entirely.
    const CSTAR = this.CSTAR = new V3(0, -15.6, -138);
    const P0 = new V3(0, -18, -160);
    const S0 = 9.0;
    const FLOOR_Y = -18;

    const frags = sliceFigure(this.models.lucy);
    this.fragmentMats = [];

    const placed = [];
    const placeFragment = (geo, kind, k, anchor, scale, ry = 0) => {
      bakePigment(geo, kind, k * 37);
      const mat = makeFragmentStone();
      this.fragmentMats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.position.copy(CSTAR).addScaledVector(new V3().subVectors(anchor, CSTAR), k);
      m.scale.setScalar(k * scale);
      m.rotation.y = ry;
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
      placed.push(m);
      return m;
    };

    placeFragment(frags.lower, 'lower', 0.85, P0, S0);
    placeFragment(frags.torso, 'torso', 1.3, P0, S0);
    placeFragment(frags.wingL, 'wing', 1.6, P0, S0);
    placeFragment(frags.wingR, 'wing', 2.0, P0, S0);
    // the head is the goddess's — a different stone, the right size
    const headAnchor = new V3(0, P0.y + S0 * 0.75, P0.z);
    placeFragment(this.models.igea.clone(), 'head', 0.66, headAnchor, 2.15, -0.1);

    // ── armatures ─────────────────────────────────────────────
    // Every fragment is physically held. Grounded fragments rest
    // on plinth slabs; raised fragments hang from thin dark rods
    // that vanish into the unlit height of the hall — the museum's
    // suspension, visible from the side, silent from the front.
    const bbox = new THREE.Box3();
    const rodMat = new THREE.MeshStandardMaterial({ color: 0x161210, roughness: 0.95 });
    for (const m of placed) {
      m.updateWorldMatrix(true, false);
      bbox.setFromObject(m);
      const cx = (bbox.min.x + bbox.max.x) / 2;
      const cz = (bbox.min.z + bbox.max.z) / 2;
      const gap = bbox.min.y - FLOOR_Y;
      if (gap < 1.4) {
        // grounded: a low plinth slab under the footprint
        const w = (bbox.max.x - bbox.min.x) * 0.72;
        const d = (bbox.max.z - bbox.min.z) * 0.72;
        this._box(w, Math.max(0.25, gap), d, cx, FLOOR_Y + gap / 2, cz, marble, g, { uv: [1, 0.3] });
      } else {
        // suspended: two rods from the dark above into the stone
        const topY = bbox.max.y - (bbox.max.y - bbox.min.y) * 0.2;
        const rodH = 8 - topY;
        for (const rx of [cx - (bbox.max.x - bbox.min.x) * 0.22, cx + (bbox.max.x - bbox.min.x) * 0.22]) {
          this._box(0.14, rodH, 0.14, rx, topY + rodH / 2, cz, rodMat, g, {});
        }
      }
    }

    // ── light ─────────────────────────────────────────────────
    // One parallel daylight from high left: every fragment, at any
    // depth, carries the same angle of light — the continuity that
    // lets separate stones agree.
    const key = new THREE.DirectionalLight(0xe6ddc9, 2.4);
    key.position.set(-26, 16, -140);
    key.target.position.set(4, -14, -172);
    key.castShadow = this.quality.shadows;
    if (key.castShadow) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -34; key.shadow.camera.right = 34;
      key.shadow.camera.top = 30; key.shadow.camera.bottom = -24;
      key.shadow.camera.near = 2; key.shadow.camera.far = 110;
      key.shadow.bias = -0.0012;
      key.shadow.normalBias = 0.06;
    }
    g.add(key, key.target);
    this.hallKey = key;

    // faint cool rim from behind-right, separating the far wings
    const rim = new THREE.SpotLight(0x6f7888, 300, 60, 0.7, 0.8, 1.6);
    rim.position.set(16, -2, -192);
    rim.target.position.set(-2, -12, -160);
    g.add(rim, rim.target);
  }

  // ── atmosphere ───────────────────────────────────────────────

  _buildAtmosphere() {
    const q = this.quality.dustScale;
    const add = (spec, count, opacity, group) => {
      if (!spec) return null;
      const d = makeDust({
        count: Math.round(count * q),
        box: spec.box, center: spec.center, opacity, map: this.glowTex,
      });
      group.add(d);
      this.dusts.push(d);
      return d;
    };
    this.faceDust = add(this.dustVeiled, 90, 0.15, this.gVeiled);

    // ambient — barely there, cool above, warm-black below
    this.scene.add(new THREE.HemisphereLight(0x2c3340, 0x0d0a08, 0.5));
  }

  // ── per-frame ────────────────────────────────────────────────

  update(progress, time, dt) {
    this.time = time;

    // chamber culling
    for (const g of this.chambers) {
      const [a, b] = g.userData.range;
      g.visible = progress >= a && progress <= b;
    }

    // fog: thin outside, dense in the stair and passages, clear in the rotunda
    const fogKeys = [
      [0.00, 0.012], [0.22, 0.026], [0.40, 0.018], [0.62, 0.016],
      [0.72, 0.022], [0.86, 0.010], [1.00, 0.008],
    ];
    this.scene.fog.density = sampleKeys(fogKeys, progress);

    // effects time
    for (const d of this.dusts) if (d.parent.visible) d.material.uniforms.uTime.value = time;
    for (const r of this.rays) if (r.parent.visible) r.material.uniforms.uTime.value = time;

    // the turn: the window light finds the face only as you commit
    // to the room — first a rim in darkness, then a goddess
    const reveal = 0.04 + 0.96 * THREE.MathUtils.smoothstep(progress, 0.46, 0.575);
    if (this.faceKey) {
      this.faceSlit.material.opacity = reveal;
      this.faceShaft.material.uniforms.uIntensity.value = 0.22 * reveal;
      this.faceBounce.intensity = 9 * reveal;
      if (this.faceDust) this.faceDust.material.uniforms.uOpacity.value = 0.15 * reveal;
    }

    // attention light on the head — an almost imperceptible swell
    for (const vfig of this.veiled) {
      vfig.spot.intensity += ((vfig.base * reveal * (1 + vfig.boost * 0.22)) - vfig.spot.intensity) * Math.min(1, dt * 5);
    }

    // the agreement: alignment confidence drives pigment and calm.
    // aWide steadies the frame on approach; aPeak reveals pigment
    // only while the fragments actually agree.
    const ss = THREE.MathUtils.smoothstep;
    this.alignment = ss(progress, 0.90, 0.935) * (1 - ss(progress, 0.965, 0.995));
    const aPeak = ss(progress, 0.922, 0.945) * (1 - ss(progress, 0.962, 0.982));
    if (this.fragmentMats) {
      for (const m of this.fragmentMats) m.customUniforms.uPigment.value = aPeak;
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
