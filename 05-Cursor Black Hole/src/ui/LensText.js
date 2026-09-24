/**
 * Gravitational lensing for headlines: every glyph sits on a spring and is pulled toward the
 * cursor in proportion to its mass. Detonations kick glyphs outward; negative mass pushes them away.
 * Only headlines on screen are simulated.
 */
const STIFFNESS = 110;
const DAMPING = 12; // slightly under-damped: glyphs settle with a small wobble
const SOFTEN2 = 40 * 40; // no jitter when the cursor sits on a glyph
const RANGE2 = 140 * 140;
const MAX_OFFSET = 60;

export class LensText {
  constructor(groups, { reducedMotion = false } = {}) {
    this.enabled = !reducedMotion;
    this.groups = groups.map(({ host, chars }) => ({
      host,
      visible: false,
      timer: 0,
      chars: chars.map((el) => ({ el, bx: 0, by: 0, x: 0, y: 0, vx: 0, vy: 0, t: '' })),
    }));

    this._io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const g = this.groups.find((g) => g.host === e.target);
          if (!g) continue;
          g.visible = e.isIntersecting;
          if (e.isIntersecting) this._scheduleMeasure(g);
        }
      },
      { rootMargin: '10% 0px' },
    );
    this.groups.forEach((g) => this._io.observe(g.host));

    this._onResize = () => this.groups.forEach((g) => this._measure(g));
    addEventListener('resize', this._onResize);
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on) {
      for (const g of this.groups) {
        for (const c of g.chars) {
          c.x = c.y = c.vx = c.vy = 0;
          c.t = '';
          c.el.style.transform = '';
        }
      }
    }
  }

  // Measure now, and again once the reveal transition has settled.
  _scheduleMeasure(g) {
    this._measure(g);
    clearTimeout(g.timer);
    g.timer = setTimeout(() => this._measure(g), 1800);
  }

  _measure(g) {
    const sx = scrollX;
    const sy = scrollY;
    for (const c of g.chars) {
      const r = c.el.getBoundingClientRect();
      c.bx = r.left + r.width / 2 + sx - c.x;
      c.by = r.top + r.height / 2 + sy - c.y;
    }
  }

  kick(x, y, power) {
    if (!this.enabled) return;
    for (const g of this.groups) {
      if (!g.visible) continue;
      for (const c of g.chars) {
        const dx = c.bx - scrollX + c.x - x;
        const dy = c.by - scrollY + c.y - y;
        const d = Math.hypot(dx, dy) + 1;
        const f = power * 1400 * Math.exp(-d / 320);
        c.vx += (dx / d) * f;
        c.vy += (dy / d) * f;
      }
    }
  }

  update(dt, pointer) {
    if (!this.enabled) return;
    const mx = pointer.client.x;
    const my = pointer.client.y;
    const m = pointer.mass;
    const sx = scrollX;
    const sy = scrollY;

    for (const g of this.groups) {
      if (!g.visible) continue;
      for (const c of g.chars) {
        const dx = mx - (c.bx - sx + c.x);
        const dy = my - (c.by - sy + c.y);
        const d2 = dx * dx + dy * dy;
        const pull = (m * 2600) / Math.sqrt(d2 + SOFTEN2) / (1 + d2 / RANGE2);
        c.vx += (dx * pull - STIFFNESS * c.x - DAMPING * c.vx) * dt;
        c.vy += (dy * pull - STIFFNESS * c.y - DAMPING * c.vy) * dt;
        c.x = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, c.x + c.vx * dt));
        c.y = Math.max(-MAX_OFFSET, Math.min(MAX_OFFSET, c.y + c.vy * dt));

        const t = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`;
        if (t !== c.t) {
          c.el.style.transform = t;
          c.t = t;
        }
      }
    }
  }

  dispose() {
    this._io.disconnect();
    removeEventListener('resize', this._onResize);
    this.groups.forEach((g) => clearTimeout(g.timer));
  }
}
