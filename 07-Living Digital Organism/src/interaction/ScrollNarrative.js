import { clamp, damp, lerp, smootherstep } from '../utils/math.js';

/**
 * Each chapter is a pose: where the camera sits, where the organism lives in
 * frame, and what shape its genome is pushed toward. Scroll blends between
 * poses with inertia; poses "hold" around each chapter centre.
 */
const POSES = [
  // hero — centred, compact, filaments relaxed
  { cam: [0, 0.15, 7.2], look: [0, 0.35, 0], org: [0, 0.35, 0], scale: 1.0, lobes: 0.34, lobeFreq: 1.2, coral: 0.04, reach: 1.0 },
  // membrane — close, organism right, filaments withdraw to expose skin
  { cam: [0, 0.3, 4.6], look: [0.9, 0.1, 0], org: [1.35, 0, 0], scale: 1.0, lobes: 0.6, lobeFreq: 1.7, coral: 0.1, reach: 0.4 },
  // filaments — organism left, long reaching strands
  { cam: [0.4, -0.4, 6.2], look: [-0.8, 0, 0], org: [-1.5, -0.1, 0], scale: 0.95, lobes: 0.22, lobeFreq: 1.0, coral: 0.0, reach: 1.9 },
  // temperament — centred low, coral ridges start forming
  { cam: [0, 0.6, 5.6], look: [0, -0.5, 0], org: [0, -0.75, 0], scale: 0.9, lobes: 0.42, lobeFreq: 2.3, coral: 0.32, reach: 1.1 },
  // evolution — right, strange coral growth
  { cam: [-0.5, 0.9, 6.4], look: [0.9, 0.2, 0], org: [1.4, 0.1, 0], scale: 1.05, lobes: 0.5, lobeFreq: 1.05, coral: 0.62, reach: 1.45 },
  // outro — pulled far back, small, quiet
  { cam: [0, 0, 11.5], look: [0, -0.9, 0], org: [0, -0.9, 0], scale: 0.7, lobes: 0.2, lobeFreq: 1.4, coral: 0.12, reach: 0.8 },
];

export class ScrollNarrative {
  constructor({ bus, sections, progressList, mobile }) {
    this.bus = bus;
    this.sections = [...sections];
    this.mobile = mobile;
    this.s = 0;          // smoothed chapter position (float)
    this.velocity = 0;
    this.active = -1;
    this.out = { cam: [0, 0, 0], look: [0, 0, 0], org: [0, 0, 0], scale: 1, lobes: 0, lobeFreq: 0, coral: 0, reach: 0 };

    progressList.innerHTML = this.sections.map(() => '<li></li>').join('');
    this.dots = [...progressList.children];

    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) e.target.classList.add('is-visible');
        else if (e.boundingClientRect.top > 0) e.target.classList.remove('is-visible');
    }, { threshold: 0.35 });
    this.sections.forEach((el) => this.io.observe(el));
  }

  get rawChapter() {
    const max = document.documentElement.scrollHeight - innerHeight;
    return max > 0 ? (scrollY / max) * (POSES.length - 1) : 0;
  }

  update(dt, reduced) {
    const prev = this.s;
    this.s = damp(this.s, this.rawChapter, reduced ? 12 : 3.2, dt);
    this.velocity = damp(this.velocity, (this.s - prev) / Math.max(dt, 1e-4), 6, dt);

    const i = clamp(Math.floor(this.s), 0, POSES.length - 2);
    // Hold each pose for a while, then travel: remap f through a plateau.
    const f = smootherstep(clamp((this.s - i - 0.15) / 0.7));
    const a = POSES[i], b = POSES[i + 1];
    const o = this.out;
    const xMul = this.mobile ? 0.15 : 1;
    for (const k of ['cam', 'look', 'org']) {
      for (let j = 0; j < 3; j++) o[k][j] = lerp(a[k][j], b[k][j], f) * (j === 0 ? xMul : 1);
    }
    if (this.mobile) { o.cam[2] += 1.5; o.org[1] += 0.5; o.look[1] += 0.5; }
    for (const k of ['scale', 'lobes', 'lobeFreq', 'coral', 'reach']) o[k] = lerp(a[k], b[k], f);

    const active = Math.round(this.s);
    if (active !== this.active) {
      this.active = active;
      this.dots.forEach((d, n) => d.classList.toggle('is-active', n === active));
      this.bus.emit('chapter', { index: active });
    }
    return o;
  }

  dispose() { this.io.disconnect(); }
}
