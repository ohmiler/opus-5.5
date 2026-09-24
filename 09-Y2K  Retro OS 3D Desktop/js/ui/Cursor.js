import { motion } from '../utils/helpers.js';

const COLORS = ['#ffffff', '#8fe6ff', '#38c8ff', '#ff9ce4', '#e8ff9a'];

/**
 * Custom pixel cursor + sparkle trail on a 2D overlay canvas.
 * Emission is proportional to pointer speed, so a still cursor stays calm.
 */
export class Cursor {
  constructor({ fine }) {
    this.el = document.getElementById('cursor');
    this.canvas = document.getElementById('sparkles');
    this.ctx = this.canvas.getContext('2d');
    this.fine = fine;
    this.x = -100; this.y = -100;
    this.lx = null; this.ly = null;
    this.parts = [];
    this.carry = 0;
    if (fine) document.body.classList.add('custom-cursor');
    this.resize();

    window.addEventListener('pointermove', (e) => {
      this.x = e.clientX; this.y = e.clientY;
      if (e.pointerType === 'mouse' || e.pointerType === 'pen') this.el.style.transform = `translate3d(${this.x}px,${this.y}px,0)`;
      this.trail(e.clientX, e.clientY);
    }, { passive: true });
    window.addEventListener('pointerdown', () => this.el.classList.add('is-down'));
    window.addEventListener('pointerup', () => this.el.classList.remove('is-down'));
    document.addEventListener('mouseleave', () => (this.el.style.opacity = '0'));
    document.addEventListener('mouseenter', () => (this.el.style.opacity = '1'));
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.dpr = dpr;
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
  }

  setState(state) {
    this.el.classList.toggle('is-hover', state === 'hover');
    this.el.classList.toggle('is-grab', state === 'grab');
  }

  trail(x, y) {
    if (motion.reduced) return;
    if (this.lx == null) { this.lx = x; this.ly = y; return; }
    const dist = Math.hypot(x - this.lx, y - this.ly);
    this.carry += dist / 14;
    const n = Math.min(6, Math.floor(this.carry));
    this.carry -= n;
    for (let i = 0; i < n; i++) {
      const t = (i + 1) / n;
      this.spawn(this.lx + (x - this.lx) * t, this.ly + (y - this.ly) * t, 0.6);
    }
    this.lx = x; this.ly = y;
  }

  spawn(x, y, energy = 1) {
    const a = Math.random() * Math.PI * 2, s = (20 + Math.random() * 60) * energy;
    this.parts.push({
      x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 10,
      life: 0, max: 0.5 + Math.random() * 0.5,
      size: 2 + Math.random() * 4 * energy,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
      color: COLORS[(Math.random() * COLORS.length) | 0],
    });
    if (this.parts.length > 260) this.parts.shift();
  }

  burst(x, y, n = 22) {
    if (motion.reduced) return;
    for (let i = 0; i < n; i++) this.spawn(x, y, 2.4);
  }

  update(dt) {
    const { ctx, dpr } = this;
    if (!this.parts.length && !this.dirty) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.dirty = this.parts.length > 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      p.life += dt;
      p.vx *= Math.exp(-3 * dt); p.vy = p.vy * Math.exp(-3 * dt) + 60 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const k = 1 - p.life / p.max;
      if (k <= 0) continue;
      const s = p.size * (0.4 + k * 0.8);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 2); ctx.quadraticCurveTo(0, 0, s * 2, 0); ctx.quadraticCurveTo(0, 0, 0, s * 2);
      ctx.quadraticCurveTo(0, 0, -s * 2, 0); ctx.quadraticCurveTo(0, 0, 0, -s * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    this.parts = this.parts.filter((p) => p.life < p.max);
  }
}
