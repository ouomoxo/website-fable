// ═══════════════════════════════════════════════════════════════
// KLEOS — main
// Real-time, baked-GI. Scroll lights the marble and pulls back;
// drag orbits; it all runs on the GPU.
// ═══════════════════════════════════════════════════════════════

import * as THREE from 'three';
import { World } from './world.js';
import { OrbitCamera } from './camera.js';
import { PostPass } from './effects.js';
import { Cathedral } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const isTouch = matchMedia('(pointer: coarse)').matches;
const prefersStill = matchMedia('(prefers-reduced-motion: reduce)').matches;

const QUALITY = {
  dpr: clamp(window.devicePixelRatio || 1, 1, isTouch ? 1.5 : 2),
  assetTier: isTouch ? 'lo' : 'hi',
  shadowSize: 0,
};

const state = { progress: 0, target: 0, entered: false, still: prefersStill, time: 0, deg: false, fps: [] };

// ── webgl bootstrap ─────────────────────────────────────────────
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas: $('#scene'), antialias: true, powerPreference: 'high-performance', stencil: false });
  if (!renderer.getContext()) throw new Error('no gl');
} catch (err) {
  $('#loader').remove(); $('#fallback').hidden = false; document.body.classList.add('entered'); throw err;
}
renderer.setPixelRatio(QUALITY.dpr);
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const world = new World(renderer, QUALITY);
const cam = new OrbitCamera(innerWidth / innerHeight);
const post = new PostPass(renderer, innerWidth, innerHeight, QUALITY.dpr);
const sound = new Cathedral();

// ── loader ──────────────────────────────────────────────────────
const loaderFill = $('#loader-fill');
async function runLoader() {
  const steps = world.buildSteps, total = steps.length;
  const setBar = (f) => { loaderFill.style.transform = `scaleX(${Math.min(1, f)})`; };
  for (let i = 0; i < total; i++) {
    await new Promise((r) => requestAnimationFrame(r));
    try { await steps[i]((f) => setBar((i + f) / total)); }
    catch (err) { console.error('build failed at step', i, err); }
    setBar((i + 1) / total);
    await new Promise((r) => setTimeout(r, 60));
  }
  finishLoading();
}
function finishLoading() {
  world.update(0, 0); cam.setScroll(0); cam.update(0, 0.016); post.render(world.scene, cam.camera, 0);
  const box = $('#loader-enter'); box.hidden = false; box.classList.add('reveal'); $('#enter').focus({ preventScroll: true });
}
const fadeBlack = { value: 1, target: 1 };
function enter() {
  if (state.entered) return;
  state.entered = true;
  $('#loader').classList.add('gone'); document.body.classList.add('entered'); scrollTo(0, 0); fadeBlack.target = 0;
}
$('#enter').addEventListener('click', enter);

// ── scroll → progress ───────────────────────────────────────────
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  state.target = max > 0 ? clamp(scrollY / max, 0, 1) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
function smoothScrollToProgress(p) {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo({ top: p * max, behavior: state.still ? 'auto' : 'smooth' });
}
addEventListener('keydown', (e) => {
  if (e.key === 'Home') { e.preventDefault(); smoothScrollToProgress(0); }
  if (e.key === 'End') { e.preventDefault(); smoothScrollToProgress(1); }
});
$$('#nav a').forEach((a) => a.addEventListener('click', (e) => {
  e.preventDefault();
  const [r0, r1] = $(a.getAttribute('href')).dataset.range.split(',').map(Number);
  smoothScrollToProgress(r0 + (r1 - r0) * 0.45);
}));
$('#wordmark').addEventListener('click', (e) => { e.preventDefault(); smoothScrollToProgress(0); });
$('#return-top').addEventListener('click', () => smoothScrollToProgress(0));

// ── orbit interaction ──────────────────────────────────────────
// desktop: drag the canvas to orbit (page scroll is the wheel, so no
// conflict). touch: scroll IS the arc, so orbit comes from device tilt.
const canvas = $('#scene');
if (!isTouch) {
  let dragging = false, lastX = 0, lastY = 0;
  canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.setPointerCapture?.(e.pointerId); });
  addEventListener('pointermove', (e) => {
    if (!dragging || state.still) return;
    cam.dragBy(e.clientX - lastX, e.clientY - lastY); lastX = e.clientX; lastY = e.clientY;
  });
  addEventListener('pointerup', () => { dragging = false; });
  addEventListener('pointercancel', () => { dragging = false; });
} else if (!prefersStill) {
  addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    cam.taz = 0.5 + clamp(e.gamma / 42, -0.6, 0.6);
    cam.tel = clamp(0.10 + ((e.beta || 45) - 45) / 130, -0.1, 0.42);
    cam.lastInput = state.time;
  }, { passive: true });
}

// ── toggles ─────────────────────────────────────────────────────
const soundToggle = $('#sound-toggle');
soundToggle.addEventListener('click', async () => {
  if (sound.enabled) { sound.disable(); soundToggle.setAttribute('aria-pressed', 'false'); }
  else { const ok = await sound.enable(); soundToggle.setAttribute('aria-pressed', ok ? 'true' : 'false'); }
});
const motionToggle = $('#motion-toggle');
const setStillUI = () => motionToggle.setAttribute('aria-pressed', state.still ? 'true' : 'false');
setStillUI();
motionToggle.addEventListener('click', () => { state.still = !state.still; setStillUI(); });

// ── copy beats ──────────────────────────────────────────────────
const chapters = $$('.chapter').map((el) => { const [a, b] = el.dataset.range.split(',').map(Number); return { el, a, b, o: -1 }; });
const navLinks = $$('#nav a');
function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function updateDOM(p) {
  let idx = 0;
  for (let i = 0; i < chapters.length; i++) {
    const c = chapters[i], w = Math.min(0.04, (c.b - c.a) * 0.3);
    let o;
    if (i === 0) o = 1 - smoothstep(c.b - w, c.b, p);
    else if (i === chapters.length - 1) o = smoothstep(c.a, c.a + w, p);
    else o = Math.min(smoothstep(c.a, c.a + w, p), 1 - smoothstep(c.b - w, c.b, p));
    if (Math.abs(o - c.o) > 0.003 || (o === 0) !== (c.o === 0)) {
      c.o = o; c.el.style.opacity = o.toFixed(3); c.el.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
      const inner = c.el.firstElementChild;
      if (inner && i !== 0) inner.style.transform = `translateY(${((1 - o) * 22).toFixed(1)}px)`;
    }
    if (p >= c.a) idx = i;
  }
  const MOVEMENT_OF = [0, 1, 1, 2, 3, 4];
  navLinks.forEach((a, i) => a.classList.toggle('active', i === (MOVEMENT_OF[idx] ?? 0)));
  document.body.classList.toggle('past-hero', p > 0.06);
}

// ── loop ────────────────────────────────────────────────────────
let lastTime = performance.now(), running = true;
document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) { lastTime = performance.now(); loop(); } });
function loop() {
  if (!running) return;
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastTime) / 1000); lastTime = now;
  state.time = state.timeLock ?? (state.time + dt);

  const damp = state.still ? 1 : 1 - Math.exp(-dt * 2.1);
  state.progress = lerp(state.progress, state.target, damp);
  if (Math.abs(state.progress - state.target) < 0.0004) state.progress = state.target;

  const p = state.progress;
  world.update(p, state.time);
  cam.setScroll(p);
  cam.update(state.time, dt);
  updateDOM(p);

  fadeBlack.value = lerp(fadeBlack.value, fadeBlack.target, 1 - Math.exp(-dt * 1.4));
  post.material.uniforms.uBlack.value = fadeBlack.value;
  sound.update(clamp(p / 0.9, 0, 1), dt, smoothstep(0.80, 0.92, p));
  post.render(world.scene, cam.camera, state.time);

  if (!state.deg && state.entered) {
    state.fps.push(dt);
    if (state.fps.length > 90) {
      const avg = state.fps.reduce((a, b) => a + b, 0) / state.fps.length; state.fps.length = 0;
      if (avg > 1 / 34) { state.deg = true; const d = Math.max(1, QUALITY.dpr * 0.72); renderer.setPixelRatio(d); post.setSize(innerWidth, innerHeight, d); }
    }
  }
}

// ── resize ──────────────────────────────────────────────────────
let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    renderer.setSize(innerWidth, innerHeight);
    post.setSize(innerWidth, innerHeight, renderer.getPixelRatio());
    cam.camera.aspect = innerWidth / innerHeight; cam.camera.updateProjectionMatrix();
    readScroll();
  }, 120);
});

// ── probe ───────────────────────────────────────────────────────
if (new URLSearchParams(location.search).has('probe')) {
  window.__KB = {
    world, cam, post,
    jump(pp) { const max = document.documentElement.scrollHeight - innerHeight; scrollTo(0, pp * max); state.target = pp; state.progress = pp; fadeBlack.value = fadeBlack.target = 0; },
    frame(pp, t) { this.jump(pp); state.timeLock = t; },
    orbit(az) { cam.taz = az; },
    info() { return { progress: state.progress, calls: renderer.info.render.calls, tris: renderer.info.render.triangles }; },
  };
}

// ── go ──────────────────────────────────────────────────────────
readScroll();
runLoader();
loop();
