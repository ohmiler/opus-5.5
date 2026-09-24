// Sound-ready interaction layer. Every UI/world event calls `play(name)`; today the cues are
// synthesised with Web Audio (no assets), later they can be swapped for samples in one place.
// Off by default, opt-in from the HUD, preference remembered.
const STORE = 'nk-sound';

export class SoundBus {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    try {
      this.wanted = localStorage.getItem(STORE) === '1';
    } catch {
      this.wanted = false;
    }
  }

  async setEnabled(on) {
    this.enabled = on;
    try {
      localStorage.setItem(STORE, on ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    if (on && !this.ctx) this.#init();
    if (!this.ctx) return;
    if (on) await this.ctx.resume();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(on ? 0.9 : 0, now, 0.4);
  }

  #init() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Noise buffer shared by rain + whooshes
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish noise: softer than white
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }

    // Ambience: rain bed + low city hum
    const rain = ctx.createBufferSource();
    rain.buffer = this.noise;
    rain.loop = true;
    const rainHp = ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 400;
    const rainLp = ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 5200;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.22;
    rain.connect(rainHp).connect(rainLp).connect(rainGain).connect(this.master);
    rain.start();

    const hum = ctx.createOscillator();
    hum.type = 'sine';
    hum.frequency.value = 55;
    const hum2 = ctx.createOscillator();
    hum2.type = 'triangle';
    hum2.frequency.value = 110.4;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.035;
    hum.connect(humGain);
    hum2.connect(humGain);
    humGain.connect(this.master);
    hum.start();
    hum2.start();
    this.ambience = { rainGain, rainLp };
  }

  // Walking speed opens the rain filter slightly — motion you can hear.
  setMotion(speed) {
    if (!this.enabled || !this.ctx) return;
    const f = 4200 + Math.min(Math.abs(speed), 12) * 260;
    this.ambience.rainLp.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.3);
  }

  #tone({ freq, type = 'sine', dur = 0.12, gain = 0.08, at = 0, to }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  #whoosh(dur = 1.4, gain = 0.25) {
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(1800, t + dur * 0.5);
    bp.frequency.exponentialRampToValueAtTime(400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
  }

  play(name, opts = {}) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'hover':
        this.#tone({ freq: 1760, dur: 0.05, gain: 0.03 });
        this.#tone({ freq: 2637, dur: 0.07, gain: 0.015, at: 0.03 });
        break;
      case 'select':
        this.#tone({ freq: 440, to: 880, dur: 0.18, gain: 0.06, type: 'triangle' });
        break;
      case 'open':
        [659, 988, 1319].forEach((f, i) => this.#tone({ freq: f, dur: 0.35, gain: 0.035, at: i * 0.06 }));
        break;
      case 'close':
        [1319, 988, 659].forEach((f, i) => this.#tone({ freq: f, dur: 0.22, gain: 0.03, at: i * 0.05 }));
        break;
      case 'whoosh':
        this.#whoosh(opts.duration ?? 1.4);
        break;
      case 'tick':
        this.#tone({ freq: 3200, dur: 0.02, gain: 0.02, type: 'square' });
        break;
      case 'drone':
        this.#tone({ freq: 180, to: 240, dur: 3.5, gain: 0.012, type: 'sawtooth' });
        break;
      case 'enter':
        this.#whoosh(2.8, 0.3);
        this.#tone({ freq: 110, to: 55, dur: 2.2, gain: 0.08 });
        break;
    }
  }

  dispose() {
    this.ctx?.close();
  }
}
