import { damp } from '../core/math.js';

/** Dot + inertial ring. States: over the glass, over links, pressed. */
export class Cursor {
  constructor(el, bus) {
    this.el = el;
    this.ring = el.querySelector('.cursor__ring');
    this.dot = el.querySelector('.cursor__dot');
    this.pulseEl = el.querySelector('.cursor__pulse');
    this.x = this.rx = window.innerWidth / 2;
    this.y = this.ry = window.innerHeight / 2;
    document.documentElement.classList.add('has-cursor');

    this._move = (e) => {
      if (e.pointerType === 'touch') return;
      this.x = e.clientX;
      this.y = e.clientY;
      el.classList.remove('is-hidden');
      el.classList.toggle('is-link', !!e.target.closest?.('a, button'));
    };
    this._down = () => el.classList.add('is-down');
    this._up = () => el.classList.remove('is-down');
    this._leave = () => el.classList.add('is-hidden');
    window.addEventListener('pointermove', this._move, { passive: true });
    window.addEventListener('pointerdown', this._down);
    window.addEventListener('pointerup', this._up);
    document.documentElement.addEventListener('pointerleave', this._leave);

    this.offs = [
      bus.on('hover', (h) => el.classList.toggle('is-blob', h)),
      bus.on('ripple', ({ onBlob }) => this.pulse(onBlob)),
    ];

    this.magnets = [...document.querySelectorAll('[data-magnetic]')].map((m) => {
      const move = (e) => {
        const r = m.getBoundingClientRect();
        m.style.translate = `${(e.clientX - (r.left + r.width / 2)) * 0.25}px ${(e.clientY - (r.top + r.height / 2)) * 0.35}px`;
      };
      const leave = () => { m.style.translate = '0 0'; };
      m.addEventListener('pointermove', move);
      m.addEventListener('pointerleave', leave);
      return () => { m.removeEventListener('pointermove', move); m.removeEventListener('pointerleave', leave); };
    });
  }

  pulse(big) {
    this.pulseEl.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.55 },
        { transform: `translate(-50%, -50%) scale(${big ? 3.2 : 2})`, opacity: 0 },
      ],
      { duration: big ? 1100 : 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    );
  }

  update(dt) {
    this.rx = damp(this.rx, this.x, 13, dt);
    this.ry = damp(this.ry, this.y, 13, dt);
    this.dot.style.transform = `translate3d(${this.x}px, ${this.y}px, 0)`;
    this.ring.style.transform = `translate3d(${this.rx}px, ${this.ry}px, 0)`;
  }

  dispose() {
    window.removeEventListener('pointermove', this._move);
    window.removeEventListener('pointerdown', this._down);
    window.removeEventListener('pointerup', this._up);
    document.documentElement.removeEventListener('pointerleave', this._leave);
    this.offs.forEach((off) => off());
    this.magnets.forEach((off) => off());
  }
}
