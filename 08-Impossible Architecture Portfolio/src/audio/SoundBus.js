/**
 * Interaction events flow through here. Other systems can subscribe (e.g. a real sound
 * design later); when enabled, it plays small synthesized cues so the design is audible now.
 */
export class SoundBus {
  constructor() {
    this.enabled = false;
    this.ctx = null;
    this.handlers = new Map();
  }

  on(event, fn) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(fn);
    return () => this.handlers.get(event).delete(fn);
  }

  emit(event, data) {
    this.handlers.get(event)?.forEach((fn) => fn(data));
    if (this.enabled) this.cue(event);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (this.enabled && !this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.18;
        this.master.connect(this.ctx.destination);
      }
    }
    this.ctx?.resume?.();
    return this.enabled;
  }

  tone(freq, dur, { type = 'sine', to = freq, gain = 1, delay = 0 } = {}) {
    const { ctx } = this;
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  cue(event) {
    switch (event) {
      case 'hover': return this.tone(1320, 0.06, { gain: 0.25 });
      case 'open': this.tone(220, 0.5, { to: 440, gain: 0.5 }); return this.tone(660, 0.4, { gain: 0.2, delay: 0.08 });
      case 'close': return this.tone(440, 0.35, { to: 180, gain: 0.4 });
      case 'section': return this.tone(98, 0.9, { type: 'triangle', gain: 0.6 });
      case 'gravity': return this.tone(60, 2.2, { to: 120, type: 'triangle', gain: 0.7 });
      case 'toggle': return this.tone(880, 0.12, { gain: 0.3 });
      default:
    }
  }

  dispose() {
    this.ctx?.close();
  }
}
