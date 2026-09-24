/**
 * Sound-ready layer. Every meaningful interaction is already emitted on the
 * bus with the parameters a sound designer needs; this class maps them to
 * named cues. It stays silent until `enable()` is called from a user gesture
 * (autoplay policy) and a real `play` implementation is supplied.
 *
 *   intro    — glass "bloom" as the object materialises
 *   hover    — soft air tick when the hand reaches the surface (true/false)
 *   ripple   — glassy ping; `strength` 0‥1 → gain / pitch, `onBlob` → body vs. air
 *   section  — low swell on each chapter; `direction` ±1 → rising / falling
 */
export class SoundHooks {
  constructor(bus, { play } = {}) {
    this.enabled = false;
    this.player = play ?? null;
    this.offs = [
      bus.on('intro', () => this.play('intro')),
      bus.on('hover', (on) => on && this.play('hover', { gain: 0.2 })),
      bus.on('ripple', ({ strength, onBlob }) => this.play(onBlob ? 'ripple' : 'ripple-air', { gain: strength })),
      bus.on('section', ({ index, direction }) => this.play('section', { index, direction })),
    ];
  }

  enable() {
    this.enabled = true;
  }

  play(cue, params = {}) {
    if (!this.enabled || !this.player) return;
    this.player(cue, params);
  }

  dispose() {
    this.offs.forEach((off) => off());
  }
}
