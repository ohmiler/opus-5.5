import { lerp } from '../util.js';

/**
 * Procedural, asset-free sound design. Every method is a safe no-op until enabled,
 * so interaction code can call it unconditionally ("sound-ready").
 */
export class AudioBus {
  constructor() {
    this.ctx = null;
    this.on = false;
    this.lastDepth = -1;
  }

  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Brown-noise ocean bed, low-passed deeper as we descend.
    const len = ctx.sampleRate * 4;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass';
    this.lp.frequency.value = 900;
    const ng = ctx.createGain();
    ng.gain.value = 0.55;
    noise.connect(this.lp).connect(ng).connect(this.master);
    noise.start();

    // Pressure drone.
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneGain.connect(this.master);
    [55, 82.6].forEach((f) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(this.droneGain);
      o.start();
    });

    // Echo bus for interaction pings.
    this.fx = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = 0.38;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.fx.connect(this.master);
    this.fx.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(wet).connect(this.master);
  }

  enable() {
    if (!this.ctx) this.build();
    this.ctx.resume();
    this.on = true;
    this.master.gain.setTargetAtTime(0.6, this.ctx.currentTime, 1.2);
  }

  disable() {
    if (!this.ctx) return;
    this.on = false;
    this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  setDepth(p) {
    if (!this.on || Math.abs(p - this.lastDepth) < 0.003) return;
    this.lastDepth = p;
    const t = this.ctx.currentTime;
    this.lp.frequency.setTargetAtTime(lerp(900, 140, p), t, 0.6);
    this.droneGain.gain.setTargetAtTime(0.015 + p * 0.09, t, 1.5);
  }

  ping(freq = 660, vol = 0.05, dur = 1.6) {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  swell() {
    if (!this.on) return;
    [110, 164.8, 220, 329.6].forEach((f, i) => this.ping(f, 0.05 - i * 0.008, 5));
  }

  whoosh() {
    if (!this.on) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(120, t + 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.5, t + 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t);
    src.stop(t + 2.1);
  }

  dispose() { this.ctx?.close(); }
}
