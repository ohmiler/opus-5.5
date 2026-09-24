/**
 * Procedural sound, off by default and enabled only by the user's click on the toggle.
 * It listens to the same interaction events as the visuals:
 *
 *   field     low drone that is almost silent at rest and deepens and opens up as charge builds
 *   detonate  sub thump plus a band-passed rush of air, scaled by the released charge
 *   chapter   a soft two-tone chime, pitched per chapter
 *   hover     a barely-there tick
 */
export class SoundDesign {
  constructor(bus) {
    this.enabled = false;
    this.ctx = null;
    this._last = { gain: -1, freq: -1, detune: 1 };

    bus.on('field', (d) => this._field(d));
    bus.on('detonate', (d) => this._detonate(d));
    bus.on('chapter', (d) => this._chapter(d));
    bus.on('hover', () => this._hover());
  }

  async setEnabled(on) {
    if (on && !this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this._build(new AC());
    }
    if (!this.ctx) return false;
    if (on) await this.ctx.resume();
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, t, on ? 0.25 : 0.08);
    this.enabled = on;
    return on;
  }

  _build(ctx) {
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(comp);

    this.droneFilter = ctx.createBiquadFilter();
    this.droneFilter.type = 'lowpass';
    this.droneFilter.frequency.value = 140;
    this.droneFilter.Q.value = 0.7;
    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 0;
    this.droneFilter.connect(this.droneGain).connect(this.master);

    this.drones = [
      [43.65, 'sine'],
      [65.41, 'sine'],
      [87.31, 'triangle'],
    ].map(([freq, type]) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.connect(this.droneFilter);
      o.start();
      return o;
    });

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  }

  _field({ presence, charge }) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const gain = 0.014 * presence + 0.17 * charge * charge;
    const freq = 120 + charge * 900;
    const detune = -charge * 300;
    const L = this._last;
    if (Math.abs(gain - L.gain) > 0.002) this.droneGain.gain.setTargetAtTime((L.gain = gain), t, 0.12);
    if (Math.abs(freq - L.freq) > 4) this.droneFilter.frequency.setTargetAtTime((L.freq = freq), t, 0.1);
    if (Math.abs(detune - L.detune) > 3) {
      L.detune = detune;
      this.drones.forEach((o) => o.detune.setTargetAtTime(detune, t, 0.2));
    }
  }

  _envelope(param, t, peak, attack, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _detonate({ kind, charge = 0 }) {
    if (!this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const click = kind === 'click';

    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.frequency.setValueAtTime(click ? 150 : 110, t);
    body.frequency.exponentialRampToValueAtTime(34, t + 0.5);
    this._envelope(bodyGain.gain, t, click ? 0.5 : 0.35 + 0.4 * charge, 0.012, 0.6 + charge * 0.6);
    body.connect(bodyGain).connect(this.master);
    body.start(t);
    body.stop(t + 1.5);

    const dur = click ? 0.25 : 0.7 + charge * 0.9;
    const air = ctx.createBufferSource();
    air.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.8;
    band.frequency.setValueAtTime(click ? 1800 : 220, t);
    band.frequency.exponentialRampToValueAtTime(click ? 600 : 3200 + charge * 3000, t + dur);
    const airGain = ctx.createGain();
    this._envelope(airGain.gain, t, click ? 0.08 : 0.06 + 0.22 * charge, 0.02, dur);
    air.connect(band).connect(airGain).connect(this.master);
    air.start(t);
    air.stop(t + dur + 0.1);
  }

  _chapter({ index }) {
    if (!this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const base = [392, 440, 523.25, 587.33, 659.25][index] ?? 440;
    for (const [mult, peak] of [[1, 0.035], [1.5, 0.018]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = base * mult;
      this._envelope(g.gain, t, peak, 0.01, 1.6);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 1.8);
    }
  }

  _hover() {
    if (!this.enabled) return;
    const { ctx } = this;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 2400;
    this._envelope(g.gain, t, 0.012, 0.004, 0.03);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + 0.06);
  }

  dispose() {
    this.ctx?.close();
  }
}
