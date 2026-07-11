// ═══════════════════════════════════════════════════════════════
// KLEOS — film
// The visual backbone is a pre-rendered Cycles sequence (path-traced
// marble, GI, soft shadows, atmospheric depth). The browser is a
// projector: scroll maps to a frame, drawn cover-fit to the canvas.
// ═══════════════════════════════════════════════════════════════

const pad = (n) => String(n).padStart(3, '0');

export class Film {
  constructor(canvas, { count, dir, ext = 'webp', stride = 1 }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.count = count;
    this.dir = dir;
    this.ext = ext;
    this.stride = stride;             // load every Nth frame (mobile thrift)
    this.images = new Array(count).fill(null);
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(coarse ? 1.5 : 2, window.devicePixelRatio || 1);
    this.curP = 0;
    this.over = 0.06;                 // overscan so parallax has room to pan
    this.px = this.py = this.tpx = this.tpy = 0;
    this._resize();
    addEventListener('resize', () => { this._resize(); this.draw(this.curP, true); });

    // parallax — the frame breathes with the pointer / device tilt, so it
    // reads as depth, not a flat scroll
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
      addEventListener('pointermove', (e) => {
        this.tpx = (e.clientX / innerWidth - 0.5) * 2;
        this.tpy = (e.clientY / innerHeight - 0.5) * 2;
      }, { passive: true });
      addEventListener('deviceorientation', (e) => {
        if (e.gamma == null) return;
        this.tpx = Math.max(-1, Math.min(1, e.gamma / 26));
        this.tpy = Math.max(-1, Math.min(1, ((e.beta || 40) - 40) / 26));
      }, { passive: true });
    }
  }

  _resize() {
    const c = this.canvas;
    c.width = Math.max(1, Math.floor(innerWidth * this.dpr));
    c.height = Math.max(1, Math.floor(innerHeight * this.dpr));
    this._dirty = true;
  }

  frameURL(i) { return `${this.dir}/f${pad(i)}.${this.ext}`; }

  // load the strided set; frame 0 and the last frame always included so
  // the ends are crisp. resolves when everything requested has settled.
  load(onProgress) {
    const idx = [];
    for (let i = 0; i < this.count; i += this.stride) idx.push(i);
    if (idx[idx.length - 1] !== this.count - 1) idx.push(this.count - 1);
    this.loadCount = idx.length;
    let done = 0;
    return Promise.all(idx.map((i) => new Promise((res) => {
      const img = new Image();
      img.decoding = 'async';
      const settle = () => { done++; onProgress?.(done / idx.length); res(); };
      img.onload = () => { this.images[i] = img; if (this._first == null) this._first = i; settle(); };
      img.onerror = settle;
      img.src = this.frameURL(i);
    }))).then(() => this.loaded = this.images.some(Boolean));
  }

  _nearest(i) {
    if (this.images[i]) return this.images[i];
    for (let d = 1; d < this.count; d++) {
      if (i - d >= 0 && this.images[i - d]) return this.images[i - d];
      if (i + d < this.count && this.images[i + d]) return this.images[i + d];
    }
    return null;
  }

  draw(progress, force = false) {
    this.curP = progress;
    const i = Math.round(Math.min(1, Math.max(0, progress)) * (this.count - 1));
    const img = this._nearest(i);
    if (!img) return;
    // ease the parallax toward the pointer/tilt target
    this.px += (this.tpx - this.px) * 0.06;
    this.py += (this.tpy - this.py) * 0.06;
    const c = this.canvas, ctx = this.ctx;
    const cw = c.width, ch = c.height, iw = img.naturalWidth, ih = img.naturalHeight;
    const s = Math.max(cw / iw, ch / ih) * (1 + this.over);   // cover + overscan
    const w = iw * s, h = ih * s;
    const maxX = (w - cw) / 2, maxY = (h - ch) / 2;
    const ox = (cw - w) / 2 - this.px * maxX * 0.55;
    const oy = (ch - h) / 2 - this.py * maxY * 0.45;
    ctx.drawImage(img, ox, oy, w, h);
    this._cur = i;
    this._dirty = false;
  }
}
