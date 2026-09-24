import * as THREE from 'three';
import { LAYERS } from '../config.js';
import { createCanvas, canvasTexture, FONT_DISPLAY, FONT_MONO } from '../utils/canvas.js';

// Animated advertisement: a canvas program redrawn at a throttled rate, with occasional
// signal glitches. Cheap: one texture upload every ~66ms per board.
export class Billboard {
  constructor({ program, width, height, canvasSize = [512, 256], fps = 15, brightness = 1.5, legs = 0 }) {
    const [cw, ch] = canvasSize;
    const { canvas, ctx } = createCanvas(cw, ch);
    this.canvas = canvas;
    this.ctx = ctx;
    this.draw = PROGRAMS[program];
    this.fps = fps;
    this.acc = 1;
    this.brightness = brightness;
    this.glitch = 0;
    this.glitchTimer = 3 + Math.random() * 6;
    this.texture = canvasTexture(canvas);

    this.group = new THREE.Group();
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });
    this.material.color.setScalar(brightness);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.frameMaterial = new THREE.MeshBasicMaterial({ color: 0x07070d });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(width + 0.5, height + 0.5, 0.4), this.frameMaterial);
    frame.position.z = -0.22;
    this.group.add(screen, frame);
    this.meshes = [screen, frame];
    if (legs > 0) {
      // steel legs down to the roof line
      for (const x of [-width / 3, width / 3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, legs, 0.3), this.frameMaterial);
        leg.position.set(x, -height / 2 - legs / 2, -0.3);
        this.group.add(leg);
        this.meshes.push(leg);
      }
    }
    for (const o of this.meshes) o.layers.enable(LAYERS.REFLECT);
    this.draw(ctx, cw, ch, 0, 0);
    this.texture.needsUpdate = true;
  }

  update(dt, t, reducedMotion) {
    const fps = reducedMotion ? 2 : this.fps;
    this.acc += dt;
    if (!reducedMotion) {
      this.glitchTimer -= dt;
      if (this.glitchTimer < 0) {
        this.glitch = 0.25;
        this.glitchTimer = 4 + Math.random() * 8;
      }
    }
    if (this.glitch > 0) this.glitch -= dt;
    if (this.acc < 1 / fps) return;
    this.acc = 0;

    const { ctx, canvas } = this;
    this.draw(ctx, canvas.width, canvas.height, t, reducedMotion ? 0 : 1);
    if (this.glitch > 0) glitchSlices(ctx, canvas.width, canvas.height);
    this.texture.needsUpdate = true;
    this.material.color.setScalar(this.brightness * (this.glitch > 0 ? 0.6 + Math.random() * 0.8 : 1));
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.frameMaterial.dispose();
    this.meshes.forEach((m) => m.geometry.dispose());
  }
}

function glitchSlices(ctx, w, h) {
  for (let i = 0; i < 5; i++) {
    const y = Math.random() * h;
    const sh = 4 + Math.random() * 24;
    const dx = (Math.random() - 0.5) * 60;
    ctx.drawImage(ctx.canvas, 0, y, w, sh, dx, y, w, sh);
  }
  ctx.fillStyle = 'rgba(255,0,90,0.18)';
  ctx.fillRect(0, Math.random() * h, w, 3);
}

const PROGRAMS = {
  // Neural-drink ad: sine ribbons + oversized type
  synth(ctx, w, h, t, m) {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#12002a');
    g.addColorStop(1, '#2a0030');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 2;
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = `hsla(${300 - k * 16}, 100%, 60%, ${0.25 + k * 0.08})`;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const y = h * 0.62 + Math.sin(x * 0.012 + t * 1.4 * m + k * 0.5) * (18 + k * 5) + Math.sin(x * 0.03 - t * m + k) * 6;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 58px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'top';
    ctx.fillText('SYNTHETIC', 24, 22);
    ctx.fillStyle = '#ff2bd6';
    ctx.fillText('DREAMS', 24, 82);
    ctx.font = `500 15px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('OKAMI NEURAL · SLEEP IS OPTIONAL™', 26, h - 30);
  },

  // Market ticker with a live-looking chart line
  ticker(ctx, w, h, t, m) {
    ctx.fillStyle = '#01100f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(25,240,255,0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    ctx.strokeStyle = '#19f0ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) {
      const s = x * 0.02 + t * 0.8 * m;
      const y = h * 0.55 - Math.sin(s) * 24 - Math.sin(s * 2.7) * 12 - (x / w) * 40;
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    const v = (12.4 + Math.sin(t * 0.7) * 1.3).toFixed(2);
    ctx.font = `800 54px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#e9fffe';
    ctx.textBaseline = 'top';
    ctx.fillText('KRN', 22, 18);
    ctx.fillStyle = '#6dff9b';
    ctx.fillText(`+${v}%`, 170, 18);
    // scrolling ticker band
    ctx.fillStyle = '#19f0ff';
    ctx.fillRect(0, h - 38, w, 38);
    ctx.fillStyle = '#01100f';
    ctx.font = `700 17px ${FONT_MONO}`;
    const line = 'ARASAKI 408.2 ▲ · MIRA 12.9 ▼ · KAIRO 88.1 ▲ · TYRELL 301.0 ▲ · HALCYON 77.7 ▼ · ';
    const lw = ctx.measureText(line).width;
    const off = -((t * 60 * m) % lw);
    ctx.fillText(line + line + line, off, h - 29);
  },

  // Optics clinic: concentric iris rings
  eye(ctx, w, h, t, m) {
    ctx.fillStyle = '#0b0600';
    ctx.fillRect(0, 0, w, h);
    const cx = w * 0.72;
    const cy = h / 2;
    for (let r = 10; r < 150; r += 11) {
      const a = 0.15 + 0.6 * Math.max(0, Math.sin(r * 0.08 - t * 3 * m));
      ctx.strokeStyle = `rgba(255,177,59,${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#ffb13b';
    ctx.beginPath();
    ctx.arc(cx + Math.sin(t * 0.9 * m) * 10, cy, 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.textBaseline = 'top';
    ctx.font = `800 40px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#fff4e0';
    ctx.fillText('SEE MORE.', 24, 44);
    ctx.fillText('SLEEP LESS.', 24, 92);
    ctx.font = `500 14px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(255,177,59,0.8)';
    ctx.fillText('IRIS+ OPTIC IMPLANTS · CLINIC LVL 3', 26, h - 34);
  },

  // Vertical radio ad with an equalizer
  radio(ctx, w, h, t, m) {
    ctx.fillStyle = '#07021a';
    ctx.fillRect(0, 0, w, h);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = `800 150px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#8f7bff';
    ctx.fillText('夜', w / 2, 30);
    ctx.font = `800 30px ${FONT_DISPLAY}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('NIGHT', w / 2, 220);
    ctx.fillText('RADIO', w / 2, 256);
    ctx.font = `500 16px ${FONT_MONO}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText('88.7 FM · 24/7', w / 2, 300);
    const bars = 14;
    const bw = (w - 60) / bars;
    for (let i = 0; i < bars; i++) {
      const v = 0.2 + 0.8 * Math.abs(Math.sin(t * (2 + i * 0.37) * m + i * 1.3)) * (m ? 1 : 0.5);
      const bh = v * 120;
      ctx.fillStyle = i % 3 === 0 ? '#ff2bd6' : '#8f7bff';
      ctx.fillRect(30 + i * bw, h - 40 - bh, bw - 4, bh);
    }
    ctx.textAlign = 'left';
  },
};
