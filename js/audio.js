// ═══════════════════════════════════════════════════════════════
// KLEOS — sound
// No recordings. A drone the depth of the building, air that
// moves like slow cloth, and the occasional far-off settling of
// stone. Synthesized on entry; silent by default.
// ═══════════════════════════════════════════════════════════════

export class Cathedral {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = false;
    this._built = false;
    this._depth = 0;
    this._stoneTimer = 0;
  }

  _build() {
    if (this._built) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // ── drone: two low voices a fifth apart, slowly detuning
    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 220;
    this.droneFilter.Q.value = 0.4;
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    this.droneFilter.connect(droneGain).connect(this.master);

    const mkVoice = (freq, type, detuneRate) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = freq;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = detuneRate;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = freq * 0.004;
      lfo.connect(lfoGain).connect(osc.frequency);
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(this.droneFilter);
      osc.start();
      lfo.start();
      return osc;
    };
    mkVoice(55, 'triangle', 0.061);
    mkVoice(82.4, 'sine', 0.043);
    mkVoice(110.3, 'sine', 0.027).frequency.value = 110.3;

    // ── air: filtered noise, breathing
    const noiseLen = 4 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let lp = 0;
    for (let i = 0; i < noiseLen; i++) {
      const white = Math.random() * 2 - 1;
      lp = lp * 0.98 + white * 0.02;                       // brownish
      data[i] = lp * 3.2;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = 'bandpass';
    this.airFilter.frequency.value = 320;
    this.airFilter.Q.value = 0.8;
    this.airGain = ctx.createGain();
    this.airGain.gain.value = 0.05;
    noise.connect(this.airFilter).connect(this.airGain).connect(this.master);
    noise.start();

    // breath LFO on the air
    const breath = ctx.createOscillator();
    breath.frequency.value = 0.05;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.02;
    breath.connect(breathGain).connect(this.airGain.gain);
    breath.start();

    this._built = true;
  }

  // far-off stone settling — a soft filtered thump with a long tail
  _stone() {
    if (!this.ctx || !this.enabled) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(58 + Math.random() * 24, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 1.4);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.03, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0004, t + 2.4);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 2.6);
  }

  async enable() {
    this._build();
    if (!this.ctx) return false;
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch (e) { return false; }
    }
    this.enabled = true;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0.5, t, 2.2);
    return true;
  }

  disable() {
    if (!this.ctx) return;
    this.enabled = false;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(0, t, 0.5);
  }

  // depth ∈ [0,1] — deeper is darker; finale opens the sky
  update(depth, dt, finale) {
    if (!this.ctx || !this.enabled) return;
    this._depth = depth;
    const drone = 240 - depth * 150 + finale * 700;        // filter closes as you sink, opens at the end
    this.droneFilter.frequency.setTargetAtTime(Math.max(60, drone), this.ctx.currentTime, 0.8);
    this.airFilter.frequency.setTargetAtTime(320 - depth * 140 + finale * 900, this.ctx.currentTime, 0.8);

    this._stoneTimer -= dt;
    if (this._stoneTimer <= 0) {
      this._stone();
      this._stoneTimer = 9 + Math.random() * 16;
    }
  }
}
