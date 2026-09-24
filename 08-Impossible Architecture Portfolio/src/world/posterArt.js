/** 2D canvas art direction for posters and screens. Pure drawing, no Three.js. */

const SERIF = '"Instrument Serif", "Times New Roman", serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

function grain(ctx, w, h, amt) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amt;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function wrap(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  lines.push(line);
  return lines;
}

function motif(ctx, kind, x, y, w, h, ink, acc, stroke = false) {
  ctx.save();
  const fill = (c) => { if (stroke) { ctx.strokeStyle = c; ctx.lineWidth = 3; ctx.stroke(); } else { ctx.fillStyle = c; ctx.fill(); } };
  switch (kind) {
    case 'arch': {
      const aw = w * 0.42, ax = x + (w - aw) / 2, top = y + h * 0.12, bottom = y + h;
      ctx.beginPath();
      ctx.rect(ax + aw * 0.14, top + aw / 2 + h * 0.06, aw, bottom - top - aw / 2 - h * 0.06);
      fill(alpha(ink, 0.18));
      ctx.beginPath();
      ctx.moveTo(ax, bottom);
      ctx.lineTo(ax, top + aw / 2);
      ctx.arc(ax + aw / 2, top + aw / 2, aw / 2, Math.PI, 0);
      ctx.lineTo(ax + aw, bottom);
      ctx.closePath();
      fill(acc);
      break;
    }
    case 'stairs': {
      const n = 8, sw = w / n, sh = h / n;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      for (let i = 0; i < n; i++) {
        ctx.lineTo(x + i * sw, y + h - (i + 1) * sh);
        ctx.lineTo(x + (i + 1) * sw, y + h - (i + 1) * sh);
      }
      ctx.lineTo(x + w, y + h);
      ctx.closePath();
      fill(ink);
      ctx.fillStyle = acc;
      ctx.fillRect(x + w * 0.62, y + h * 0.05, w * 0.08, h * 0.25);
      break;
    }
    case 'circle': {
      const r = Math.min(w, h) * 0.42, cx = x + w / 2, cy = y + h * 0.48;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = alpha(ink, 0.8); ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + r * 0.32, cy - r * 0.18, r * 0.46, 0, Math.PI * 2);
      fill(acc);
      ctx.fillStyle = alpha(ink, 0.8);
      ctx.fillRect(x, cy + r * 0.2, w, 3);
      break;
    }
    case 'slabs': {
      for (let i = 0; i < 5; i++) {
        const sw = w * (0.55 + (i % 2) * 0.2), sx = x + (i * 37) % (w - sw);
        ctx.beginPath(); ctx.rect(sx, y + h * 0.1 + i * h * 0.17, sw, h * 0.1);
        fill(i === 2 ? acc : alpha(ink, 0.85));
      }
      break;
    }
    default: {
      const vx = x + w / 2, vy = y + h * 0.35;
      ctx.strokeStyle = alpha(ink, 0.55); ctx.lineWidth = 2;
      for (let i = 0; i <= 12; i++) {
        ctx.beginPath(); ctx.moveTo(vx, vy); ctx.lineTo(x + (w * i) / 12, y + h); ctx.stroke();
      }
      for (let i = 1; i <= 6; i++) {
        const t = Math.pow(i / 6, 2), yy = vy + (y + h - vy) * t;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); ctx.stroke();
      }
      ctx.beginPath(); ctx.rect(vx - w * 0.07, vy - h * 0.3, w * 0.14, h * 0.3);
      fill(acc);
    }
  }
  ctx.restore();
}

export function drawPoster(ctx, w, h, p) {
  const [bg, ink, acc] = p.palette;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const m = w * 0.06;

  ctx.strokeStyle = alpha(ink, 0.14);
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const x = m + ((w - 2 * m) * i) / 6;
    ctx.beginPath(); ctx.moveTo(x, m); ctx.lineTo(x, h - m); ctx.stroke();
  }
  ctx.strokeStyle = alpha(ink, 0.5);
  ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);

  ctx.fillStyle = ink;
  ctx.textBaseline = 'top';
  ctx.font = `500 ${w * 0.022}px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.fillText(`N° ${p.index}`, m + 20, m + 22);
  ctx.textAlign = 'right';
  ctx.fillText(`${p.discipline.toUpperCase()} — ${p.year}`, w - m - 20, m + 22);

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${w * 0.5}px ${SERIF}`;
  ctx.fillStyle = alpha(ink, 0.08);
  ctx.fillText(p.index, m + 10, h * 0.62);

  motif(ctx, p.motif, m + w * 0.08, m + h * 0.08, w - 2 * m - w * 0.16, h * 0.46, ink, acc);

  ctx.fillStyle = ink;
  ctx.font = `400 ${w * 0.115}px ${SERIF}`;
  const lines = wrap(ctx, p.title, w - 2 * m - 40);
  const lh = w * 0.105;
  const base = h - m - w * 0.12 - (lines.length - 1) * lh;
  lines.forEach((l, i) => ctx.fillText(l, m + 20, base + i * lh));

  ctx.font = `500 ${w * 0.02}px ${MONO}`;
  ctx.fillStyle = alpha(ink, 0.7);
  ctx.fillText(p.location.toUpperCase(), m + 22, h - m - 30);
  ctx.textAlign = 'right';
  ctx.fillText('MONOLITH ARCHIVE', w - m - 22, h - m - 30);

  grain(ctx, w, h, 14);
}

export function drawScreen(ctx, w, h, p) {
  const [, , acc] = p.palette;
  const light = '#f2ece2';
  ctx.fillStyle = '#0e0d0c';
  ctx.fillRect(0, 0, w, h);

  motif(ctx, p.motif, w * 0.52, h * 0.14, w * 0.4, h * 0.72, light, acc, true);

  ctx.fillStyle = acc;
  ctx.font = `500 ${w * 0.014}px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.fillText(`● LIVE — N° ${p.index} / ${p.discipline.toUpperCase()}`, w * 0.06, h * 0.1);

  ctx.fillStyle = light;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${w * 0.085}px ${SERIF}`;
  const lines = wrap(ctx, p.title, w * 0.44);
  lines.forEach((l, i) => ctx.fillText(l, w * 0.06, h * 0.5 + i * w * 0.075));

  ctx.font = `italic 400 ${w * 0.024}px ${SERIF}`;
  ctx.fillStyle = alpha(light, 0.7);
  wrap(ctx, p.lede, w * 0.4).forEach((l, i) => ctx.fillText(l, w * 0.06, h * 0.8 + i * w * 0.03));

  ctx.fillStyle = 'rgba(0,0,0,.28)';
  for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1.5);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
