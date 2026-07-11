// ═══════════════════════════════════════════════════════════════
// KLEOS — main
// A projector for a pre-rendered Cycles film. Scroll is the reel.
// ═══════════════════════════════════════════════════════════════

import { Film } from './film.js';
import { Cathedral } from './audio.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;

const isTouch = matchMedia('(pointer: coarse)').matches;
const prefersStill = matchMedia('(prefers-reduced-motion: reduce)').matches;

const FRAMES = 84;

const state = {
  progress: 0,
  target: 0,
  entered: false,
  still: prefersStill,
  time: 0,
};

// ── projector ──────────────────────────────────────────────────

const canvas = $('#scene');
const film = new Film(canvas, {
  count: FRAMES,
  dir: isTouch ? 'assets/film-lo' : 'assets/film',
  ext: 'webp',
  stride: 1,
});
const sound = new Cathedral();

// ── loader ─────────────────────────────────────────────────────

const loaderFill = $('#loader-fill');
const setBar = (f) => { loaderFill.style.transform = `scaleX(${Math.min(1, f)})`; };

async function runLoader() {
  let ok = false;
  try {
    await film.load((f) => setBar(f * 0.98));
    ok = film.loaded;
  } catch (err) {
    console.error('film load failed', err);
  }
  setBar(1);
  if (!ok) { fail(); return; }
  finishLoading();
}

function fail() {
  $('#loader').remove();
  $('#fallback').hidden = false;
  document.body.classList.add('entered');
}

function finishLoading() {
  film.draw(0, true);
  const enterBox = $('#loader-enter');
  enterBox.hidden = false;
  enterBox.classList.add('reveal');
  $('#enter').focus({ preventScroll: true });
}

const fadeBlack = { value: 1, target: 1 };

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

function smoothScrollToProgress(p) {
  const max = document.documentElement.scrollHeight - innerHeight;
  scrollTo({ top: p * max, behavior: state.still ? 'auto' : 'smooth' });
}
addEventListener('keydown', (e) => {
  if (e.key === 'Home') { e.preventDefault(); smoothScrollToProgress(0); }
  if (e.key === 'End') { e.preventDefault(); smoothScrollToProgress(1); }
});

$$('#nav a').forEach((a) => {
  a.addEventListener('click', (e) => {
    e.preventDefault();
    const target = $(a.getAttribute('href'));
    const [r0, r1] = target.dataset.range.split(',').map(Number);
    smoothScrollToProgress(r0 + (r1 - r0) * 0.45);
  });
});
$('#wordmark').addEventListener('click', (e) => { e.preventDefault(); smoothScrollToProgress(0); });
$('#return-top').addEventListener('click', () => smoothScrollToProgress(0));

// ── sound + motion toggles ─────────────────────────────────────

const soundToggle = $('#sound-toggle');
soundToggle.addEventListener('click', async () => {
  if (sound.enabled) { sound.disable(); soundToggle.setAttribute('aria-pressed', 'false'); }
  else { const ok = await sound.enable(); soundToggle.setAttribute('aria-pressed', ok ? 'true' : 'false'); }
});

const motionToggle = $('#motion-toggle');
const setStillUI = () => motionToggle.setAttribute('aria-pressed', state.still ? 'true' : 'false');
setStillUI();
motionToggle.addEventListener('click', () => { state.still = !state.still; setStillUI(); });

// ── copy beats ─────────────────────────────────────────────────

const chapters = $$('.chapter').map((el) => {
  const [a, b] = el.dataset.range.split(',').map(Number);
  return { el, a, b, o: -1 };
});
const navLinks = $$('#nav a');

function smoothstep(a, b, x) { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

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
  const MOVEMENT_OF = [0, 1, 1, 2, 3, 4];
  navLinks.forEach((a, i) => a.classList.toggle('active', i === (MOVEMENT_OF[activeIdx] ?? 0)));
  document.body.classList.toggle('past-hero', p > 0.06);
}

// ── frame loop ─────────────────────────────────────────────────

let lastTime = performance.now();
let running = true;
const black = $('#entrance-black');

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
  state.time += dt;

  const damp = state.still ? 1 : 1 - Math.exp(-dt * 2.1);
  state.progress = lerp(state.progress, state.target, damp);
  if (Math.abs(state.progress - state.target) < 0.0004) state.progress = state.target;

  const p = state.progress;
  film.draw(p);
  updateDOM(p);

  fadeBlack.value = lerp(fadeBlack.value, fadeBlack.target, 1 - Math.exp(-dt * 1.4));
  if (black) black.style.opacity = fadeBlack.value.toFixed(3);

  sound.update(clamp(p / 0.9, 0, 1), dt, smoothstep(0.80, 0.92, p));
}

// ── resize ─────────────────────────────────────────────────────

let resizeT;
addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(readScroll, 120);
});

// ── probe (screenshots) ────────────────────────────────────────

if (new URLSearchParams(location.search).has('probe')) {
  window.__KB = {
    film,
    jump(p) {
      const max = document.documentElement.scrollHeight - innerHeight;
      scrollTo(0, p * max);
      state.target = p; state.progress = p;
      fadeBlack.value = fadeBlack.target = 0;
      film.draw(p, true); updateDOM(p);
    },
    frame(p) { this.jump(p); },
    info() { return { progress: state.progress, frame: film._cur, loaded: film.loaded }; },
  };
}

// ── go ─────────────────────────────────────────────────────────

readScroll();
runLoader();
loop();
