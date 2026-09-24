import { mulberry32 } from '../utils/math.js';

// Paints placeholder artworks procedurally onto canvases.
// Each style is a small composition routine; all share palette, grain and
// vignette so the archive reads as one coherent body of work.

function valueNoise(rand) {
  const size = 256;
  const perm = new Uint8Array(size * 2);
  const vals = new Float32Array(size);
  for (let i = 0; i < size; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = size - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < size; i++) perm[i + size] = perm[i];
  const fade = (t) => t * t * (3 - 2 * t);
  const at = (x, y) => vals[perm[(perm[x & 255] + y) & 511] & 255];
  const n2 = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = fade(x - xi);
    const yf = fade(y - yi);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
  return (x, y, oct = 3) => {
    let sum = 0;
    let amp = 0.5;
    let f = 1;
    for (let i = 0; i < oct; i++) {
      sum += n2(x * f, y * f) * amp;
      f *= 2;
      amp *= 0.5;
    }
    return sum / (1 - Math.pow(0.5, oct));
  };
}

const styles = {
  orb(ctx, w, h, p, r) {
    const cx = w * (0.4 + r() * 0.2);
    const cy = h * (0.42 + r() * 0.12);
    const rad = Math.min(w, h) * (0.26 + r() * 0.08);
    const halo = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad * 3.2);
    halo.addColorStop(0, p[1] + 'aa');
    halo.addColorStop(0.35, p[1] + '33');
    halo.addColorStop(1, p[0] + '00');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createRadialGradient(cx - rad * 0.35, cy - rad * 0.4, rad * 0.05, cx, cy, rad);
    g.addColorStop(0, p[2]);
    g.addColorStop(0.55, p[1]);
    g.addColorStop(1, p[3]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fill();
    // Floor reflection line
    ctx.fillStyle = p[2] + '22';
    ctx.fillRect(0, cy + rad * 1.6, w, 1.5);
  },

  bands(ctx, w, h, p, r) {
    let y = 0;
    while (y < h) {
      const bh = h * (0.02 + r() * 0.12);
      const c = p[1 + Math.floor(r() * 3)];
      const g = ctx.createLinearGradient(0, 0, w, 0);
      g.addColorStop(0, c + '00');
      g.addColorStop(0.2 + r() * 0.3, c + 'dd');
      g.addColorStop(1, c + '10');
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, bh);
      y += bh + h * r() * 0.04;
    }
    ctx.filter = 'blur(6px)';
    ctx.drawImage(ctx.canvas, 0, 0);
    ctx.filter = 'none';
  },

  gradient(ctx, w, h, p, r) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p[3]);
    g.addColorStop(0.55, p[1]);
    g.addColorStop(0.8, p[2]);
    g.addColorStop(1, p[0]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) {
      const x = w * r();
      const y = h * (0.3 + r() * 0.5);
      const rg = ctx.createRadialGradient(x, y, 0, x, y, w * (0.3 + r() * 0.4));
      rg.addColorStop(0, p[2] + '55');
      rg.addColorStop(1, p[2] + '00');
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }
    // Horizon silhouette
    ctx.fillStyle = p[0];
    ctx.beginPath();
    ctx.moveTo(0, h);
    const base = h * 0.82;
    for (let x = 0; x <= w; x += w / 40) {
      ctx.lineTo(x, base - Math.sin(x * 0.008 + r()) * h * 0.02 - r() * h * 0.01);
    }
    ctx.lineTo(w, h);
    ctx.fill();
  },

  rings(ctx, w, h, p, r) {
    const cx = w / 2;
    const cy = h / 2;
    const max = Math.hypot(w, h) * 0.5;
    for (let i = 40; i > 0; i--) {
      const rad = (i / 40) * max;
      ctx.strokeStyle = (i % 3 === 0 ? p[1] : p[3]) + (i % 5 === 0 ? 'ff' : '88');
      ctx.lineWidth = 1 + (i % 7 === 0 ? 3 : 0);
      ctx.beginPath();
      ctx.arc(cx + Math.sin(i) * 4, cy + Math.cos(i * 1.3) * 4, rad, 0, Math.PI * 2);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, max * 0.35);
    g.addColorStop(0, p[2]);
    g.addColorStop(0.3, p[1] + '88');
    g.addColorStop(1, p[1] + '00');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  },

  caustics(ctx, w, h, p, r) {
    const n = valueNoise(r);
    const img = ctx.getImageData(0, 0, w, h);
    const c1 = hex(p[1]);
    const c2 = hex(p[2]);
    const c0 = hex(p[3]);
    const s = 3.2 / w;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = n(x * s, y * s, 3);
        const line = Math.pow(1 - Math.abs(Math.sin(v * 22)), 8);
        const t = Math.min(1, line + v * 0.35);
        const col = mix(c0, t > 0.7 ? c2 : c1, t);
        const i = (y * w + x) * 4;
        img.data[i] = col[0];
        img.data[i + 1] = col[1];
        img.data[i + 2] = col[2];
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  blocks(ctx, w, h, p, r) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p[3]);
    g.addColorStop(1, p[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    const ground = h * 0.78;
    let x = w * 0.08;
    while (x < w * 0.92) {
      const bw = w * (0.08 + r() * 0.18);
      const bh = h * (0.25 + r() * 0.45);
      const lit = ctx.createLinearGradient(x, 0, x + bw, 0);
      lit.addColorStop(0, p[1]);
      lit.addColorStop(0.35, p[1]);
      lit.addColorStop(0.36, p[2]);
      lit.addColorStop(1, p[0]);
      ctx.fillStyle = lit;
      ctx.fillRect(x, ground - bh, bw, bh);
      x += bw + w * r() * 0.04;
    }
    ctx.fillStyle = p[0];
    ctx.fillRect(0, ground, w, h - ground);
  },

  contours(ctx, w, h, p, r) {
    const n = valueNoise(r);
    ctx.lineWidth = 1.4;
    const s = 2.4 / w;
    const levels = 26;
    const img = ctx.getImageData(0, 0, w, h);
    const c = hex(p[1]);
    const c2 = hex(p[2]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = n(x * s, y * s, 4) * levels;
        const f = v - Math.floor(v);
        const edge = f < 0.06 ? 1 : 0;
        const i = (y * w + x) * 4;
        const major = Math.floor(v) % 5 === 0;
        const col = major ? c2 : c;
        const a = edge * (major ? 1 : 0.55);
        img.data[i] = img.data[i] * (1 - a) + col[0] * a;
        img.data[i + 1] = img.data[i + 1] * (1 - a) + col[1] * a;
        img.data[i + 2] = img.data[i + 2] * (1 - a) + col[2] * a;
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  arches(ctx, w, h, p, r) {
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, w, h);
    const cols = 3;
    const aw = w / (cols + 0.5);
    for (let i = 0; i < cols; i++) {
      const x = aw * 0.25 + i * aw + aw * 0.08;
      const top = h * (0.25 + r() * 0.08);
      const width = aw * 0.84;
      const g = ctx.createLinearGradient(x, top, x + width, h);
      g.addColorStop(0, p[1]);
      g.addColorStop(1, p[3]);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, top + width / 2);
      ctx.arc(x + width / 2, top + width / 2, width / 2, Math.PI, 0);
      ctx.lineTo(x + width, h);
      ctx.fill();
    }
    ctx.fillStyle = p[0] + '55';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  },

  grain(ctx, w, h, p, r) {
    const n = valueNoise(r);
    const img = ctx.getImageData(0, 0, w, h);
    const a = hex(p[3]);
    const b = hex(p[1]);
    const c = hex(p[2]);
    const s = 4 / w;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const v = n(x * s, y * s * 1.6, 5);
        const col = v < 0.5 ? mix(a, b, v * 2) : mix(b, c, (v - 0.5) * 2);
        const i = (y * w + x) * 4;
        const speck = Math.random() < 0.004 ? 60 : 0;
        img.data[i] = col[0] + speck;
        img.data[i + 1] = col[1] + speck;
        img.data[i + 2] = col[2] + speck;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  },

  pillars(ctx, w, h, p, r) {
    const count = 11;
    const gap = w / count;
    for (let i = 0; i < count; i++) {
      const x = i * gap + gap * 0.3;
      const pw = gap * 0.4;
      const top = h * (0.12 + Math.abs(Math.sin(i * 0.9)) * 0.3);
      const g = ctx.createLinearGradient(x, 0, x + pw, 0);
      g.addColorStop(0, p[3]);
      g.addColorStop(0.5, p[1]);
      g.addColorStop(1, p[2]);
      ctx.fillStyle = g;
      ctx.fillRect(x, top, pw, h - top);
    }
    const fade = ctx.createLinearGradient(0, 0, 0, h);
    fade.addColorStop(0, p[0] + '00');
    fade.addColorStop(1, p[0] + 'ee');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, w, h);
  },

  waves(ctx, w, h, p, r) {
    ctx.globalCompositeOperation = 'lighter';
    for (let j = 0; j < 60; j++) {
      const t = j / 60;
      ctx.strokeStyle = (j % 4 === 0 ? p[2] : p[1]) + '40';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const u = x / w;
        const env = Math.sin(u * Math.PI);
        const y =
          h / 2 +
          Math.sin(u * 14 + t * 6) * h * 0.18 * env * (0.3 + t) +
          Math.sin(u * 37 + j) * h * 0.015 * env;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  dots(ctx, w, h, p, r) {
    ctx.fillStyle = p[1];
    ctx.fillRect(0, 0, w, h);
    const step = w / 42;
    const cx = w * 0.62;
    const cy = h * 0.4;
    for (let y = step / 2; y < h; y += step) {
      for (let x = step / 2; x < w; x += step) {
        const d = Math.hypot(x - cx, y - cy) / Math.max(w, h);
        const rad = step * 0.48 * Math.max(0, 1 - d * 1.6);
        ctx.fillStyle = d < 0.12 ? p[2] : p[0];
        ctx.beginPath();
        ctx.arc(x, y, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  },

  grid(ctx, w, h, p, r) {
    const cells = 14;
    const s = w / cells;
    for (let y = 0; y < h / s; y++) {
      for (let x = 0; x < cells; x++) {
        const on = r() < 0.12;
        ctx.fillStyle = on ? p[1] : p[2] + '0c';
        ctx.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
        if (on) {
          const g = ctx.createRadialGradient(x * s + s / 2, y * s + s / 2, 0, x * s + s / 2, y * s + s / 2, s * 3);
          g.addColorStop(0, p[1] + '44');
          g.addColorStop(1, p[1] + '00');
          ctx.fillStyle = g;
          ctx.fillRect(x * s - s * 3, y * s - s * 3, s * 7, s * 7);
        }
      }
    }
    ctx.strokeStyle = p[3];
    ctx.lineWidth = 1;
    for (let i = 0; i <= cells; i++) {
      ctx.beginPath();
      ctx.moveTo(i * s, 0);
      ctx.lineTo(i * s, h);
      ctx.stroke();
    }
  },

  moire(ctx, w, h, p, r) {
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, w, h);
    const draw = (cx, cy, color) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      for (let rad = 4; rad < Math.max(w, h) * 1.2; rad += 7) {
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.stroke();
      }
    };
    draw(w * 0.35, h * 0.4, p[0] + 'cc');
    draw(w * 0.65, h * 0.55, p[3] + 'aa');
  },

  flow(ctx, w, h, p, r) {
    const n = valueNoise(r);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 900; i++) {
      let x = r() * w;
      let y = r() * h;
      ctx.strokeStyle = (r() < 0.15 ? p[2] : p[1]) + '22';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 40; s++) {
        const a = n(x / w * 2.5, y / h * 2.5, 2) * Math.PI * 4;
        x += Math.cos(a) * 5;
        y += Math.sin(a) * 5;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  },

  void(ctx, w, h, p, r) {
    ctx.fillStyle = p[2];
    ctx.fillRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, p[1]);
    g.addColorStop(1, p[3]);
    ctx.fillStyle = g;
    ctx.fillRect(w * 0.1, h * 0.08, w * 0.8, h * 0.72);
    // One doorway of shadow
    ctx.fillStyle = p[0];
    ctx.fillRect(w * 0.58, h * 0.44, w * 0.1, h * 0.36);
    ctx.fillStyle = p[0] + '22';
    ctx.beginPath();
    ctx.moveTo(w * 0.58, h * 0.8);
    ctx.lineTo(w * 0.68, h * 0.8);
    ctx.lineTo(w * 0.95, h);
    ctx.lineTo(w * 0.35, h);
    ctx.fill();
  },

  horizon(ctx, w, h, p, r) {
    const line = h * (0.48 + r() * 0.06);
    const sky = ctx.createLinearGradient(0, 0, 0, line);
    sky.addColorStop(0, p[3]);
    sky.addColorStop(1, p[2]);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, line);
    const sea = ctx.createLinearGradient(0, line, 0, h);
    sea.addColorStop(0, p[1]);
    sea.addColorStop(1, p[0]);
    ctx.fillStyle = sea;
    ctx.fillRect(0, line, w, h - line);
    for (let i = 0; i < 120; i++) {
      const y = line + Math.pow(r(), 2) * (h - line);
      ctx.fillStyle = p[2] + '18';
      ctx.fillRect(r() * w, y, w * (0.05 + r() * 0.3), 1 + (y - line) / 90);
    }
  },

  letter(ctx, w, h, p, r) {
    ctx.fillStyle = p[1];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = p[0];
    ctx.font = `italic ${Math.floor(h * 0.95)}px "Instrument Serif", Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('a', w * 0.52, h * 0.78);
    ctx.fillStyle = p[1];
    ctx.beginPath();
    ctx.arc(w * 0.46, h * 0.56, w * 0.07, 0, Math.PI * 2);
    ctx.fill();
  },
};

function hex(c) {
  const v = parseInt(c.slice(1, 7), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mix(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function finish(ctx, w, h, p) {
  // Vignette
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  // Film grain
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const g = (Math.random() - 0.5) * 18;
    d[i] += g;
    d[i + 1] += g;
    d[i + 2] += g;
  }
  ctx.putImageData(img, 0, 0);
}

export class ArtworkFactory {
  constructor({ maxSize = 1024 } = {}) {
    this.maxSize = maxSize;
  }

  paint(project, index) {
    const { aspect, palette, style } = project;
    const w = aspect >= 1 ? this.maxSize : Math.round(this.maxSize * aspect);
    const h = aspect >= 1 ? Math.round(this.maxSize / aspect) : this.maxSize;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = palette[0];
    ctx.fillRect(0, 0, w, h);
    const rand = mulberry32(1000 + index * 7919);
    (styles[style] || styles.gradient)(ctx, w, h, palette, rand);
    finish(ctx, w, h, palette);
    return canvas;
  }
}
