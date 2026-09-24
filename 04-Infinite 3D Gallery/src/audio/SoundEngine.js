import { clamp } from '../utils/math.js';

// Sound-ready interaction layer.
//
// Every meaningful interaction already calls `sound.play(name)`; by default
// the engine is muted and those calls are free. Enabling it (via the HUD,
// i.e. a user gesture) lazily starts a tiny Web Audio synth:
//   hover  – a soft glassy tick
//   open   – a low swell with a filtered air sweep
//   close  – the swell, reversed and shorter
//   step   – a subtle double tick when moving between works
//   room   – a distant low bell when entering a new room
// plus an air bed whose level follows camera speed.
//
// To swap in recorded samples, replace the bodies of the `voices` below.
export class SoundEngine {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this._lastHover = 0;
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled) this._start();
    else this._fadeBed(0);
    return this.enabled;
  }

  _start() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      this._createBed();
    }
    this.ctx.resume();
  }

  _createBed() {
    const ctx = this.ctx;
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // brown-ish noise
      data[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    this.bedFilter = ctx.createBiquadFilter();
    this.bedFilter.type = 'lowpass';
    this.bedFilter.frequency.value = 300;
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    src.connect(this.bedFilter).connect(this.bed).connect(this.master);
    src.start();
  }

  _fadeBed(v) {
    if (!this.bed) return;
    this.bed.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3);
  }

  // Called every frame with camera speed (units/sec).
  setMotion(speed) {
    if (!this.enabled || !this.bed) return;
    const s = clamp(Math.abs(speed) / 30, 0, 1);
    const t = this.ctx.currentTime;
    this.bed.gain.setTargetAtTime(0.05 + s * 0.22, t, 0.25);
    this.bedFilter.frequency.setTargetAtTime(260 + s * 1400, t, 0.25);
  }

  play(name) {
    if (!this.enabled || !this.ctx) return;
    if (name === 'hover') {
      const now = performance.now();
      if (now - this._lastHover < 90) return;
      this._lastHover = now;
    }
    this.voices[name]?.call(this, this.ctx.currentTime);
  }

  _tone(t, { freq, type = 'sine', attack = 0.005, decay = 0.2, gain = 0.1, to }) {
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  _air(t, { from, to, dur, gain }) {
    const ctx = this.ctx;
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t);
  }

  voices = {
    hover(t) {
      this._tone(t, { freq: 2400, to: 1800, decay: 0.08, gain: 0.025 });
    },
    open(t) {
      this._tone(t, { freq: 110, to: 82, attack: 0.25, decay: 1.4, gain: 0.12 });
      this._air(t, { from: 300, to: 2400, dur: 1.2, gain: 0.08 });
    },
    close(t) {
      this._air(t, { from: 2000, to: 300, dur: 0.8, gain: 0.06 });
      this._tone(t, { freq: 90, to: 120, attack: 0.1, decay: 0.7, gain: 0.07 });
    },
    step(t) {
      this._tone(t, { freq: 1600, decay: 0.06, gain: 0.03 });
      this._tone(t + 0.07, { freq: 2100, decay: 0.06, gain: 0.02 });
      this._air(t, { from: 500, to: 1800, dur: 0.9, gain: 0.05 });
    },
    room(t) {
      this._tone(t, { freq: 196, attack: 0.02, decay: 2.4, gain: 0.05 });
      this._tone(t, { freq: 293.7, attack: 0.02, decay: 2.0, gain: 0.025 });
    },
  };

  dispose() {
    this.ctx?.close();
  }
}
