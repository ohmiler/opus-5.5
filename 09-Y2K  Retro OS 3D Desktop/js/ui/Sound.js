/**
 * Sound-ready interaction layer. Every interaction calls `play(name)`;
 * nothing is heard until the visitor opts in. Sounds are tiny synthesized
 * blips (no downloads) so they can later be swapped for real samples.
 */
export class Sound {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.last = {};
    this.onChange = null;
  }

  enable() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.16;
      this.master.connect(this.ctx.destination);
    }
    this.ctx.resume?.();
    this.enabled = true;
    this.onChange?.(true);
  }

  disable() { this.enabled = false; this.onChange?.(false); }
  toggle() { this.enabled ? this.disable() : this.enable(); return this.enabled; }

  tone(freq, dur = 0.08, type = 'square', { slide = 0, vol = 1, delay = 0 } = {}) {
    if (!this.enabled || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  play(name) {
    if (!this.enabled) return;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < 45) return; // de-duplicate bursts
    this.last[name] = now;
    const r = Math.random();
    switch (name) {
      case 'hover': return this.tone(1500 + r * 200, 0.035, 'sine', { vol: 0.18 });
      case 'click': return this.tone(900, 0.06, 'square', { slide: 0.55, vol: 0.25 });
      case 'grab': return this.tone(280, 0.09, 'sine', { slide: 2, vol: 0.5 });
      case 'drop': return this.tone(420, 0.12, 'sine', { slide: 0.4, vol: 0.5 });
      case 'type': return this.tone(1700 + r * 500, 0.02, 'square', { vol: 0.1 });
      case 'open': [523, 784, 1046].forEach((f, i) => this.tone(f, 0.12, 'triangle', { delay: i * 0.05, vol: 0.5 })); return;
      case 'close': [1046, 784, 523].forEach((f, i) => this.tone(f, 0.09, 'triangle', { delay: i * 0.04, vol: 0.4 })); return;
      case 'min': return this.tone(800, 0.14, 'sine', { slide: 0.3, vol: 0.4 });
      case 'spin': return this.tone(300, 0.4, 'sawtooth', { slide: 4, vol: 0.08 });
      case 'boing': return this.tone(180, 0.3, 'sine', { slide: 3.5, vol: 0.5 });
      case 'error': this.tone(220, 0.18, 'square', { vol: 0.3 }); return this.tone(165, 0.26, 'square', { delay: 0.16, vol: 0.3 });
      case 'egg': [659, 784, 988, 1319, 1568].forEach((f, i) => this.tone(f, 0.16, 'square', { delay: i * 0.07, vol: 0.25 })); return;
      case 'boot': [262, 330, 392, 523, 659].forEach((f, i) => this.tone(f, 0.9 - i * 0.1, 'triangle', { delay: i * 0.09, vol: 0.35 })); return;
      case 'suck': return this.tone(900, 0.4, 'sine', { slide: 0.15, vol: 0.4 });
    }
  }

  /** Play a simple chiptune: notes as [midi|null, beats]. Returns a stop fn. */
  melody(notes, bpm = 150) {
    if (!this.enabled || !this.ctx) return () => {};
    const beat = 60 / bpm;
    let t = 0;
    const oscs = [];
    for (const [n, b] of notes) {
      if (n != null) {
        const f = 440 * Math.pow(2, (n - 69) / 12);
        this.tone(f, b * beat * 0.9, 'square', { delay: t, vol: 0.22 });
        this.tone(f / 2, b * beat * 0.5, 'triangle', { delay: t, vol: 0.3 });
      }
      t += b * beat;
    }
    return () => { this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02); setTimeout(() => this.master && (this.master.gain.value = 0.16), 120); };
  }
}
