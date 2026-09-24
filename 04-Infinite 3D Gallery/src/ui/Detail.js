import { pad } from '../utils/math.js';
import { env } from '../utils/env.js';
import { rooms } from '../gallery/projects.js';

// Project view layered over the focused artwork. The WebGL card does the
// heavy lifting (it fills the frame); this adds letterbox, type and controls,
// revealed line by line once the camera has landed.
export class Detail {
  constructor(root, { total, onClose, onStep }) {
    this.root = root;
    this.total = total;
    this.els = {
      index: root.querySelector('[data-detail-index]'),
      room: root.querySelector('[data-detail-room]'),
      kicker: root.querySelector('[data-detail-kicker]'),
      title: root.querySelector('[data-detail-title]'),
      desc: root.querySelector('[data-detail-desc]'),
      year: root.querySelector('[data-detail-year]'),
      client: root.querySelector('[data-detail-client]'),
      discipline: root.querySelector('[data-detail-discipline]'),
      close: root.querySelector('[data-detail-close]'),
      prev: root.querySelector('[data-detail-prev]'),
      next: root.querySelector('[data-detail-next]'),
    };
    this.els.close.addEventListener('click', onClose);
    this.els.prev.addEventListener('click', () => onStep(-1));
    this.els.next.addEventListener('click', () => onStep(1));
    this.open = false;
    this._timers = [];
  }

  _fill(card) {
    const p = card.project;
    const e = this.els;
    e.index.textContent = `${pad(card.index + 1)} / ${pad(this.total)}`;
    e.room.textContent = `Room ${rooms[card.room].numeral} — ${rooms[card.room].name}`;
    e.kicker.textContent = p.discipline;
    e.year.textContent = p.year;
    e.client.textContent = p.client;
    e.discipline.textContent = p.discipline;
    e.desc.textContent = p.description;
    // Each word sits in a mask so it can rise into place.
    e.title.innerHTML = p.title
      .split(' ')
      .map((w, i) => `<span class="mask"><span style="--i:${i}">${w}</span></span>`)
      .join(' ');
    this.root.style.setProperty('--accent', p.palette[1]);
  }

  _later(fn, ms) {
    this._timers.push(setTimeout(fn, ms));
  }

  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  show(card, delay = 0) {
    this._clearTimers();
    this._fill(card);
    this.open = true;
    this.root.hidden = false;
    this.root.setAttribute('aria-hidden', 'false');
    this.root.classList.add('is-framing'); // letterbox starts with the camera
    this._later(() => {
      this.root.classList.add('is-open');
      // Keyboard users land on Close; pointer users get focus on the dialog itself.
      (env.keyboard ? this.els.close : this.root).focus({ preventScroll: true });
    }, delay);
  }

  // Card-to-card: type exits, camera travels, new type enters.
  swap(card, delay) {
    this._clearTimers();
    this.root.classList.remove('is-open');
    this._later(() => this._fill(card), 450);
    this._later(() => this.root.classList.add('is-open'), delay);
  }

  hide() {
    this._clearTimers();
    this.open = false;
    this.root.classList.remove('is-open');
    this._later(() => this.root.classList.remove('is-framing'), 250);
    this._later(() => {
      if (this.open) return;
      this.root.hidden = true;
      this.root.setAttribute('aria-hidden', 'true');
    }, 1300);
  }
}
