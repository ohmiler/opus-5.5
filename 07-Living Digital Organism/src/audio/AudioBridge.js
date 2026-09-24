/**
 * Optional, off by default. Listens to organism events on the bus and turns
 * them into a very quiet synthesized presence. Swap this class for real
 * sound design without touching scene code.
 */
export class AudioBridge {
  constructor({ bus, button }) {
    this.bus = bus;
    this.button = button;
    this.ctx = null;
    this.enabled = false;
    this.offs = [];
    this.onClick = () => this.toggle();
    button.addEventListener('click', this.onClick);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.button.setAttribute('aria-pressed', String(this.enabled));
    this.button.querySelector('span').textContent = this.enabled ? 'on' : 'off';
    if (this.enabled) this.start(); else this.stop();
  }

  start() {
    if (!this.ctx) this.build();
    this.ctx.resume();
    this.master.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
    this.offs = [
      this.bus.on('breath', ({ rate }) => this.breath(rate)),
      this.bus.on('provoke', ({ strength }) => this.provoke(strength)),
      this.bus.on('mutate', () => this.chime()),
    ];
  }

  stop() {
    this.offs.forEach((off) => off());
    this.offs = [];
    if (this.ctx) this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  build() {
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);
    // Low drone: two detuned sines through a lowpass.
    this.lp = ctx.createBiquadFilter();
    this.lp.type = 'lowpass'; this.lp.frequency.value = 320;
    this.drone = ctx.createGain(); this.drone.gain.value = 0.05;
    for (const f of [55, 55.7]) {
      const o = ctx.createOscillator(); o.frequency.value = f; o.connect(this.lp); o.start();
    }
    this.lp.connect(this.drone).connect(this.master);
    // Shared noise buffer for breaths/bristles.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  burst({ freq, q, gain, attack, release }) {
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq; bp.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + release);
    src.connect(bp).connect(g).connect(this.master);
    src.start(t); src.stop(t + attack + release + 0.05);
  }

  breath(rate) { this.burst({ freq: 500 + rate * 900, q: 0.7, gain: 0.03, attack: 0.9, release: 1.6 }); }
  provoke(s) {
    this.burst({ freq: 2400, q: 3, gain: 0.08 * s, attack: 0.005, release: 0.5 });
    this.lp.frequency.setTargetAtTime(900, this.ctx.currentTime, 0.02);
    this.lp.frequency.setTargetAtTime(320, this.ctx.currentTime + 0.1, 0.8);
  }
  chime() {
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 660 + Math.random() * 220;
    g.gain.value = 0; g.gain.linearRampToValueAtTime(0.02, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + 2.6);
  }

  dispose() {
    this.stop();
    this.button.removeEventListener('click', this.onClick);
    this.ctx?.close();
  }
}
