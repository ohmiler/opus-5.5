import { clamp, damp } from '../utils/math.js';

/**
 * Maps scroll to a continuous chapter value (0 … n-1) and reveals content as it arrives.
 * `chapter` is smoothed with inertia so fast scrolls carry momentum into the scene;
 * `velocity` (viewport heights / s) feeds scroll "wind" into the simulation.
 */
export class Narrative {
  constructor({ sections, chapters, hud, bus, reducedMotion = false }) {
    this.sections = sections;
    this.chapters = chapters;
    this.hud = hud;
    this.bus = bus;
    this.reducedMotion = reducedMotion;

    this.stops = [];
    this.target = 0;
    this.chapter = 0;
    this.velocity = 0;
    this.index = -1;
    this._lastY = scrollY;

    this._onScroll = () => this._sync();
    this._onResize = () => {
      this.measure();
      this._sync();
    };
    addEventListener('scroll', this._onScroll, { passive: true });
    addEventListener('resize', this._onResize);
    this._ro = new ResizeObserver(this._onResize);
    this._ro.observe(document.body);

    document.querySelectorAll('[data-go]').forEach((el) =>
      el.addEventListener('click', (e) => {
        e.preventDefault();
        this.goTo(Number(el.dataset.go));
      }),
    );

    this.measure();
    this._sync();
    this.chapter = this.target;
  }

  /** Scroll positions at which each section sits centred in the viewport. */
  measure() {
    const vh = innerHeight;
    const max = Math.max(0, document.documentElement.scrollHeight - vh);
    let prev = -Infinity;
    this.stops = this.sections.map((s) => {
      const r = s.getBoundingClientRect();
      const stop = clamp(r.top + scrollY + r.height / 2 - vh / 2, 0, max);
      prev = Math.max(stop, prev + 1); // strictly increasing
      return prev;
    });
  }

  startReveals() {
    this._io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          e.target.classList.add('is-visible');
          this._io.unobserve(e.target);
        }
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );
    this.sections.forEach((s) => this._io.observe(s));
  }

  goTo(i) {
    scrollTo({ top: this.stops[i] ?? 0, behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }

  _progressAt(y) {
    const s = this.stops;
    if (y <= s[0]) return 0;
    for (let i = 0; i < s.length - 1; i++) {
      if (y < s[i + 1]) return i + (y - s[i]) / (s[i + 1] - s[i]);
    }
    return s.length - 1;
  }

  _sync() {
    this.target = this._progressAt(scrollY);
    const idx = Math.round(this.target);
    if (idx !== this.index) {
      const first = this.index === -1;
      this.index = idx;
      this.hud.setChapter(idx, this.chapters[idx].name);
      if (!first) this.bus.emit('chapter', { index: idx });
    }
  }

  update(dt) {
    const y = scrollY;
    const inst = (y - this._lastY) / Math.max(dt, 1e-3) / innerHeight;
    this._lastY = y;
    this.velocity = damp(this.velocity, clamp(inst, -4, 4), 6, dt);
    this.chapter = damp(this.chapter, this.target, this.reducedMotion ? 10 : 3.2, dt);
  }

  dispose() {
    removeEventListener('scroll', this._onScroll);
    removeEventListener('resize', this._onResize);
    this._ro.disconnect();
    this._io?.disconnect();
  }
}
