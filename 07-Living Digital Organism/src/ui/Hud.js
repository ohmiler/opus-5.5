/**
 * Live instrument readout: numbers are the organism's actual state,
 * so the typography is part of the feedback loop, not decoration.
 */
export class Hud {
  constructor({ bus }) {
    const $ = (id) => document.getElementById(id);
    this.el = { resp: $('hud-resp'), prox: $('hud-prox'), agit: $('hud-agit'), gen: $('hud-gen'), clock: $('hud-clock') };
    this.whisper = $('whisper');
    this.acc = 0;
    this.start = performance.now();
    this.whisperText = '';
    this.offs = [
      bus.on('mutate', ({ generation }) => { this.el.gen.textContent = String(generation).padStart(3, '0'); this.flash(this.el.gen); }),
      bus.on('provoke', () => this.flash(this.el.agit)),
    ];
  }

  flash(el) {
    el.classList.add('hot');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('hot'), 900);
  }

  say(text) {
    if (text === this.whisperText) return;
    this.whisperText = text;
    this.whisper.classList.remove('is-on');
    clearTimeout(this._wt);
    if (text) this._wt = setTimeout(() => { this.whisper.textContent = text; this.whisper.classList.add('is-on'); }, 500);
  }

  update(dt, { breathRate, proximity, agitation, idle, habituation }) {
    this.acc += dt;
    if (this.acc > 0.12) {
      this.acc = 0;
      this.el.resp.textContent = `${(breathRate * 60).toFixed(1)}/min`;
      this.el.prox.textContent = proximity.toFixed(2);
      this.el.agit.textContent = agitation.toFixed(2);
      const s = Math.floor((performance.now() - this.start) / 1000);
      this.el.clock.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
    this.say(
      idle > 0.35 ? 'you are still. it is changing.'
        : habituation > 1.6 ? 'it has stopped fearing you.'
        : '',
    );
  }

  dispose() { this.offs.forEach((off) => off()); }
}
