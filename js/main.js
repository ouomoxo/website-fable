// ═══════════════════════════════════════════════════════════════
// KATABASIS — main
// Boot, descent, and return.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { World } from './world.js';
import { CameraRig } from './camera.js';
import { PostPass } from './effects.js';
import { Cathedral } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ── capability & quality ───────────────────────────────────────

const isTouch = matchMedia('(pointer: coarse)').matches;
const prefersStill = matchMedia('(prefers-reduced-motion: reduce)').matches;

const QUALITY = {
  dpr: clamp(window.devicePixelRatio || 1, 1, isTouch ? 1.8 : 2),
  texSize: isTouch ? 384 : 512,
  shadows: !isTouch,
  rubble: isTouch ? 24 : 44,
  dustScale: isTouch ? 0.55 : 1,
};

// ── state ──────────────────────────────────────────────────────

const state = {
  progress: 0,          // damped
  target: 0,            // from scroll
  entered: false,
  still: prefersStill,  // reduced-motion (system or manual)
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },   // raw and smoothed, in [-1,1]
  time: 0,
  fpsSamples: [],
  degraded: false,
};

// ── webgl bootstrap ────────────────────────────────────────────

let renderer;
try {
  const canvas = $('#scene');
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    stencil: false,
  });
  const gl = renderer.getContext();
  if (!gl) throw new Error('no context');
} catch (err) {
  $('#loader').remove();
  $('#fallback').hidden = false;
  document.body.classList.add('entered');
  throw err;
}

renderer.setPixelRatio(QUALITY.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = QUALITY.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;               // graded in the post pass
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;   // post converts to sRGB

const world = new World(renderer, QUALITY);
const rig = new CameraRig(innerWidth / innerHeight);
const post = new PostPass(renderer, innerWidth, innerHeight, QUALITY.dpr);
const sound = new Cathedral();

// ── loader: build one step per frame so the bar tells the truth ─

const loaderFill = $('#loader-fill');
const loaderTask = $('#loader-task');
const loaderPct = $('#loader-pct');

function runLoader() {
  const steps = world.buildSteps;
  const total = steps.length;
  let i = 0;
  const minShow = 340;                                     // ms per step — pacing, not padding
  let lastT = performance.now();

  function step() {
    if (i >= total) {
      finishLoading();
      return;
    }
    const [label, fn] = steps[i];
    loaderTask.textContent = label;
    requestAnimationFrame(() => {
      try {
        fn();
      } catch (err) {
        console.error('build failed at', label, err);
      }
      i++;
      const pct = Math.round((i / total) * 100);
      loaderFill.style.transform = `scaleX(${i / total})`;
      loaderPct.textContent = pct;
      const wait = Math.max(0, minShow - (performance.now() - lastT));
      setTimeout(() => { lastT = performance.now(); step(); }, wait);
    });
  }
  step();
}

function finishLoading() {
  loaderTask.textContent = 'THE DOOR IS OPEN';
  // one warm-up render so entry doesn't stutter
  world.update(0, 0, 0.016, rig.camera.position);
  rig.update(0, 0, 0, 0, 0);
  post.render(world.scene, rig.camera, 0);
  const enterBox = $('#loader-enter');
  enterBox.hidden = false;
  enterBox.classList.add('reveal');
  $('#enter-silence').focus({ preventScroll: true });
}

function enter(withSound) {
  if (state.entered) return;
  state.entered = true;
  if (withSound) {
    sound.enable().then((ok) => setSoundUI(ok));
  }
  $('#loader').classList.add('gone');
  document.body.classList.add('entered');
  scrollTo(0, 0);
  // fade from black
  fadeBlack.target = 0;
}

$('#enter-silence').addEventListener('click', () => enter(false));
$('#enter-sound').addEventListener('click', () => enter(true));

// ── scroll → progress ──────────────────────────────────────────

function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.target = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
}
addEventListener('scroll', readScroll, { passive: true });

// keyboard: arrows / page keys already scroll natively; make sure
// space doesn't get eaten by buttons
addEventListener('keydown', (e) => {
  if (e.key === 'Home') { e.preventDefault(); smoothScrollToProgress(0); }
  if (e.key === 'End') { e.preventDefault(); smoothScrollToProgress(1); }
});

function smoothScrollToProgress(p) {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo({ top: p * max, behavior: state.still ? 'auto' : 'smooth' });
}

// nav
$$('#nav a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = $(a.getAttribute('href'));
    const [r0, r1] = target.dataset.range.split(',').map(Number);
    smoothScrollToProgress(r0 + (r1 - r0) * 0.42);
  });
});
$('#wordmark').addEventListener('click', (e) => {
  e.preventDefault();
  smoothScrollToProgress(0);
});
$('#return-top').addEventListener('click', () => smoothScrollToProgress(0));

// ── pointer ────────────────────────────────────────────────────

addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  state.pointer.x = (e.clientX / innerWidth) * 2 - 1;
  state.pointer.y = (e.clientY / innerHeight) * 2 - 1;
  cursor.move(e.clientX, e.clientY);
}, { passive: true });

// ── custom cursor ──────────────────────────────────────────────

const cursor = (() => {
  const el = $('#cursor');
  const pos = { x: innerWidth / 2, y: innerHeight / 2, tx: innerWidth / 2, ty: innerHeight / 2 };
  let visible = false;

  if (!isTouch) {
    document.body.classList.add('no-cursor');
    document.addEventListener('mouseleave', () => el.classList.add('hidden'));
    document.addEventListener('mouseenter', () => el.classList.remove('hidden'));
    document.addEventListener('pointerover', (e) => {
      if (e.target.closest('[data-cursor="hover"], button, a')) el.classList.add('hot');
      else el.classList.remove('hot');
    });
  }

  return {
    move(x, y) {
      pos.tx = x; pos.ty = y;
      if (!visible && !isTouch) { visible = true; }
    },
    frame(dt) {
      if (isTouch) return;
      const k = 1 - Math.exp(-dt * 18);
      pos.x = lerp(pos.x, pos.tx, k);
      pos.y = lerp(pos.y, pos.ty, k);
      el.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    },
  };
})();

// ── sound toggle ───────────────────────────────────────────────

const soundToggle = $('#sound-toggle');
function setSoundUI(on) {
  soundToggle.setAttribute('aria-pressed', on ? 'true' : 'false');
}
soundToggle.addEventListener('click', async () => {
  if (sound.enabled) { sound.disable(); setSoundUI(false); }
  else { const ok = await sound.enable(); setSoundUI(ok); }
});

// ── motion toggle (STILL) ──────────────────────────────────────

const motionToggle = $('#motion-toggle');
function setStillUI() {
  motionToggle.setAttribute('aria-pressed', state.still ? 'true' : 'false');
}
setStillUI();
motionToggle.addEventListener('click', () => {
  state.still = !state.still;
  setStillUI();
});

// ── sections ───────────────────────────────────────────────────

const chapters = $$('.chapter').map((el) => {
  const [a, b] = el.dataset.range.split(',').map(Number);
  return { el, a, b, o: -1 };
});
const navLinks = $$('#nav a');
const gaugeFill = $('#gauge-fill');
const gaugeDepth = $('#gauge-depth');

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function updateDOM(p) {
  let activeIdx = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const w = Math.min(0.045, (c.b - c.a) * 0.3);
    let o;
    if (i === 0) o = 1 - smoothstep(c.b - w, c.b, p);                  // hero starts on
    else if (i === chapters.length - 1) o = smoothstep(c.a, c.a + w, p); // finale stays on
    else o = Math.min(smoothstep(c.a, c.a + w, p), 1 - smoothstep(c.b - w, c.b, p));

    if (Math.abs(o - c.o) > 0.003 || (o === 0) !== (c.o === 0)) {
      c.o = o;
      c.el.style.opacity = o.toFixed(3);
      c.el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
      const inner = c.el.firstElementChild;
      if (inner && i !== 0) inner.style.transform = `translateY(${((1 - o) * 26).toFixed(1)}px)`;
    }
    if (p >= c.a) activeIdx = i;
  }
  navLinks.forEach((a, i) => a.classList.toggle('active', i === activeIdx));

  gaugeFill.style.height = `${(p * 100).toFixed(2)}%`;
  const depth = Math.round(rig.depthMeters);
  gaugeDepth.textContent = `${depth} m below`;
}

// ── veiled figures: light swells toward your attention ─────────

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
function updateVotives(dt) {
  for (const v of world.veiled) {
    let target = 0;
    if (!isTouch) {
      // angular proximity of the pointer ray to the figure
      pointerNDC.set(state.pointer.sx, -state.pointer.sy);
      raycaster.setFromCamera(pointerNDC, rig.camera);
      const toFig = v.pos.clone().sub(rig.camera.position);
      const dist = toFig.length();
      if (dist < 45) {
        const cos = raycaster.ray.direction.dot(toFig.normalize());
        target = smoothstep(0.965, 0.997, cos);
      }
    } else {
      // on touch, figures wake as you pass them
      const d = v.pos.distanceTo(rig.camera.position);
      target = smoothstep(18, 9, d);
    }
    v.boost = lerp(v.boost, target, Math.min(1, dt * 4));
  }
}

// ── post uniforms: entrance & finale ───────────────────────────

const fadeBlack = { value: 1, target: 1 };

// ── frame loop ─────────────────────────────────────────────────

let lastTime = performance.now();
let running = true;

document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) { lastTime = performance.now(); loop(); }
});

function loop() {
  if (!running) return;
  requestAnimationFrame(loop);

  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  state.time = state.timeLock ?? (state.time + dt);

  // damped progress — the building refuses to be rushed
  const damp = state.still ? 1 : 1 - Math.exp(-dt * 2.1);
  state.progress = lerp(state.progress, state.target, damp);
  if (Math.abs(state.progress - state.target) < 0.0004) state.progress = state.target;

  // smoothed pointer
  const pk = 1 - Math.exp(-dt * 4);
  state.pointer.sx = lerp(state.pointer.sx, state.pointer.x, pk);
  state.pointer.sy = lerp(state.pointer.sy, state.pointer.y, pk);

  const p = state.progress;
  const swayAmp = state.still ? 0 : (isTouch ? 0.7 : 0.35);
  const px = state.still ? 0 : state.pointer.sx;
  const py = state.still ? 0 : state.pointer.sy;

  rig.update(p, px, py, state.time, swayAmp);

  // carried lantern floats a little ahead of you — unlit until you cross the threshold
  if (world.lantern) {
    const dir = new THREE.Vector3();
    rig.camera.getWorldDirection(dir);
    world.lantern.position.copy(rig.camera.position).addScaledVector(dir, 6.5);
    world.lantern.position.y += 1.6;
    world.lantern.intensity = 17 * smoothstep(0.02, 0.06, p) * (1 - smoothstep(0.9, 0.99, p));
  }

  world.update(p, state.time, dt, rig.camera.position);
  updateVotives(dt);
  updateDOM(p);
  cursor.frame(dt);

  // entrance / finale grading
  fadeBlack.value = lerp(fadeBlack.value, fadeBlack.target, 1 - Math.exp(-dt * 1.4));
  const whiteout = smoothstep(0.955, 0.995, p);
  post.material.uniforms.uBlack.value = fadeBlack.value;
  post.material.uniforms.uWhite.value = whiteout;
  post.material.uniforms.uGrain.value = 0.055 * (1 - whiteout * 0.7);

  sound.update(clamp(p / 0.9, 0, 1), dt, whiteout);

  post.render(world.scene, rig.camera, state.time);

  // adaptive degrade: if the descent chugs, shed pixels first
  if (!state.degraded && state.entered) {
    state.fpsSamples.push(dt);
    if (state.fpsSamples.length > 90) {
      const avg = state.fpsSamples.reduce((a, b) => a + b, 0) / state.fpsSamples.length;
      state.fpsSamples.length = 0;
      if (avg > 1 / 34) {
        state.degraded = true;
        const dpr = Math.max(1, QUALITY.dpr * 0.72);
        renderer.setPixelRatio(dpr);
        post.setSize(innerWidth, innerHeight, dpr);
      }
    }
  }
}

// ── resize ─────────────────────────────────────────────────────

let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
    rig.camera.aspect = innerWidth / innerHeight;
    rig.camera.updateProjectionMatrix();
    readScroll();
  }, 120);
});

// ── test probe (only with ?probe in the URL) ───────────────────

if (new URLSearchParams(location.search).has('probe')) {
  window.__KB = {
    jump(p) {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, p * max);
      state.target = p;
      state.progress = p;
      fadeBlack.value = fadeBlack.target;
    },
    // deterministic offline frame: pin progress AND the clock
    frame(p, t) {
      this.jump(p);
      state.timeLock = t;
    },
    info() {
      return {
        progress: state.progress,
        target: state.target,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
    },
    pick(nx, ny) {
      const rc = new THREE.Raycaster();
      rc.setFromCamera(new THREE.Vector2(nx, ny), rig.camera);
      const hits = rc.intersectObjects(world.scene.children, true);
      return hits.slice(0, 3).map((h) => ({
        type: h.object.type,
        geo: h.object.geometry?.type,
        pos: h.object.position.toArray().map((n) => Math.round(n * 10) / 10),
        dist: Math.round(h.distance * 10) / 10,
        parent: h.object.parent?.userData?.range || null,
      }));
    },
  };
}

// ── go ─────────────────────────────────────────────────────────

readScroll();
runLoader();
loop();
