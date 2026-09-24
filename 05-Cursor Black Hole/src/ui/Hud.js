const pad = (n) => String(n).padStart(2, '0');

/** Fixed interface chrome. Writes only when a value actually changes. */
export class Hud {
  constructor(total) {
    const $ = (s) => document.querySelector(s);
    this.indexEl = $('[data-chapter-index]');
    this.nameEl = $('[data-chapter-name]');
    this.massEl = $('[data-mass]');
    this.stateEl = $('[data-state]');
    this.soundEl = $('[data-sound]');
    this.railButtons = [...document.querySelectorAll('.rail [data-go]')];
    $('[data-chapter-total]').textContent = pad(total);

    this._name = this.nameEl.textContent;
    this._mass = '';
    this._state = '';
    this._level = -1;
  }

  setChapter(index, name) {
    this.indexEl.textContent = pad(index + 1);
    if (name !== this._name) {
      this._name = name;
      this.nameEl.textContent = name;
      this.nameEl.classList.remove('is-swap');
      void this.nameEl.offsetWidth;
      this.nameEl.classList.add('is-swap');
    }
    this.railButtons.forEach((b, i) => {
      if (i === index) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  setMass(m) {
    const s = (m < -0.005 ? '−' : '') + Math.abs(m).toFixed(2);
    if (s !== this._mass) {
      this._mass = s;
      this.massEl.textContent = s;
    }
  }

  setState(s) {
    if (s !== this._state) {
      this._state = s;
      this.stateEl.textContent = s;
    }
  }

  /** Drives the sound button's level meter (0..1). */
  setLevel(v) {
    const q = Math.round(v * 40) / 40;
    if (q !== this._level) {
      this._level = q;
      this.soundEl.style.setProperty('--level', q);
    }
  }
}
