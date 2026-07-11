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
  shadows: true,
  assetTier: isTouch ? 'lo' : 'hi',
  dustScale: isTouch ? 0.6 : 1,
};

// ── state ──────────────────────────────────────────────────────

const state = {
  progress: 0,
  target: 0,
  entered: false,
  still: prefersStill,
  pointer: { x: 0, y: 0, sx: 0, sy: 0 },
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

// ── loader ─────────────────────────────────────────────────────

const loaderFill = $('#loader-fill');

async function runLoader() {
  const steps = world.buildSteps;
  const total = steps.length;
  const setBar = (f) => { loaderFill.style.transform = `scaleX(${Math.min(1, f)})`; };

  for (let i = 0; i < total; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    try {
      // steps may be async (asset downloads) and may report progress
      await steps[i]((f) => setBar((i + f) / total));
    } catch (err) {
      console.error('build failed at step', i, err);
    }
    setBar((i + 1) / total);
    await new Promise((r) => setTimeout(r, 90));
  }
  finishLoading();
}

function finishLoading() {
  // one warm-up render so entry doesn't stutter
  world.update(0, 0, 0.016);
  rig.update(0, 0, 0, 0, 0);
  post.render(world.scene, rig.camera, 0);
  const enterBox = $('#loader-enter');
  enterBox.hidden = false;
  enterBox.classList.add('reveal');
  $('#enter').focus({ preventScroll: true });
}

function enter() {
  if (state.entered) return;
  state.entered = true;
  $('#loader').classList.add('gone');
  document.body.classList.add('entered');
  scrollTo(0, 0);
  fadeBlack.target = 0;
}

$('#enter').addEventListener('click', enter);

// ── scroll → progress ──────────────────────────────────────────

function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.target = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
}
addEventListener('scroll', readScroll, { passive: true });

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
    smoothScrollToProgress(r0 + (r1 - r0) * 0.45);
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
}, { passive: true });

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

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

function updateDOM(p) {
  let activeIdx = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i];
    const w = Math.min(0.04, (c.b - c.a) * 0.3);
    let o;
    if (i === 0) o = 1 - smoothstep(c.b - w, c.b, p);
    else if (i === chapters.length - 1) o = smoothstep(c.a, c.a + w, p);
    else o = Math.min(smoothstep(c.a, c.a + w, p), 1 - smoothstep(c.b - w, c.b, p));

    if (Math.abs(o - c.o) > 0.003 || (o === 0) !== (c.o === 0)) {
      c.o = o;
      c.el.style.opacity = o.toFixed(3);
      c.el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
      const inner = c.el.firstElementChild;
      if (inner && i !== 0) inner.style.transform = `translateY(${((1 - o) * 22).toFixed(1)}px)`;
    }
    if (p >= c.a) activeIdx = i;
  }
  navLinks.forEach((a, i) => a.classList.toggle('active', i === activeIdx));
  document.body.classList.toggle('past-hero', p > 0.06);
}

// ── attention: light swells faintly toward your gaze ───────────

const raycaster = new THREE.Raycaster();
const pointerNDC = new THREE.Vector2();
function updateAttention(dt) {
  for (const v of world.veiled) {
    let target = 0;
    if (!isTouch) {
      pointerNDC.set(state.pointer.sx, -state.pointer.sy);
      raycaster.setFromCamera(pointerNDC, rig.camera);
      const toFig = v.pos.clone().sub(rig.camera.position);
      const dist = toFig.length();
      if (dist < 40) {
        const cos = raycaster.ray.direction.dot(toFig.normalize());
        target = smoothstep(0.972, 0.998, cos);
      }
    } else {
      const d = v.pos.distanceTo(rig.camera.position);
      target = smoothstep(16, 9, d);
    }
    v.boost = lerp(v.boost, target, Math.min(1, dt * 3));
  }
}

// ── frame loop ─────────────────────────────────────────────────

const fadeBlack = { value: 1, target: 1 };

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
  const swayAmp = state.still ? 0 : (isTouch ? 0.7 : 0.4);
  const px = state.still ? 0 : state.pointer.sx;
  const py = state.still ? 0 : state.pointer.sy;

  rig.update(p, px, py, state.time, swayAmp);
  world.update(p, state.time, dt);
  updateAttention(dt);
  updateDOM(p);

  // entrance fade
  fadeBlack.value = lerp(fadeBlack.value, fadeBlack.target, 1 - Math.exp(-dt * 1.4));
  post.material.uniforms.uBlack.value = fadeBlack.value;

  sound.update(clamp(p / 0.9, 0, 1), dt, smoothstep(0.955, 1, p));

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
    world, rig, post,
    jump(p) {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, p * max);
      state.target = p;
      state.progress = p;
      fadeBlack.value = fadeBlack.target;
    },
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
