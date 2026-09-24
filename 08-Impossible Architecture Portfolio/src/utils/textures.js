import * as THREE from 'three';

export function canvasTexture(w, h, draw, { srgb = true, repeat = false } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

/** Seamless board-marked concrete: grain, blotches, formwork seams and tie holes. */
export function concreteTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#cdc6bb';
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 70; i++) {
      const x = Math.random() * w, y = Math.random() * h, r = 20 + Math.random() * 110;
      const a = Math.random() * 0.07;
      const dark = Math.random() > 0.3;
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
        const cx = x + ox * w, cy = y + oy * h;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, dark ? `rgba(58,52,46,${a})` : `rgba(255,250,240,${a})`);
        g.addColorStop(1, 'rgba(58,52,46,0)');
        ctx.fillStyle = g;
        ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }
    }

    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 16;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);

    ctx.strokeStyle = 'rgba(60,54,48,.22)';
    ctx.lineWidth = 1.5;
    for (let y = 0; y < h; y += 128) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.75); ctx.lineTo(w, y + 0.75); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,36,32,.4)';
    for (let x = 64; x < w; x += 256) for (let y = 64; y < h; y += 256) {
      ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
  }, { repeat: true });
}

/**
 * Typographic texture for in-scene lettering.
 * items: [{ text, font, color, x, y, align, spacing }], coordinates in 0..1.
 */
export function typeTexture(w, h, items) {
  return canvasTexture(w, h, (ctx) => {
    for (const it of items) {
      ctx.font = it.font;
      ctx.fillStyle = it.color || '#1b1916';
      ctx.textAlign = it.align || 'center';
      ctx.textBaseline = it.baseline || 'middle';
      if ('letterSpacing' in ctx) ctx.letterSpacing = it.spacing || '0px';
      ctx.fillText(it.text, it.x * w, it.y * h);
    }
  });
}
