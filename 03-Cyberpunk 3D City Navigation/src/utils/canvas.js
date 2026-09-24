import * as THREE from 'three';

export const FONT_DISPLAY = '"Unbounded", "Arial Black", sans-serif';
export const FONT_MONO = '"JetBrains Mono", ui-monospace, monospace';

export function createCanvas(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

export function canvasTexture(canvas, { anisotropy = 4 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Draws text as a lit neon tube: soft halo, coloured tube, hot white core.
export function neonText(ctx, text, x, y, { size, color, font = FONT_DISPLAY, weight = 800, align = 'center', baseline = 'middle', tube = 0.06, fill = 0.12, letterSpacing = 0 }) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.lineJoin = 'round';

  // faint filled face so the letters still read when the tube is dim
  ctx.globalAlpha = fill;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);

  ctx.globalAlpha = 1;
  ctx.shadowColor = color;
  ctx.shadowBlur = size * 0.35;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * tube;
  ctx.strokeText(text, x, y);

  ctx.shadowBlur = size * 0.08;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = size * tube * 0.35;
  ctx.strokeText(text, x, y);
  ctx.restore();
}

export function plainText(ctx, text, x, y, { size, color = '#fff', font = FONT_MONO, weight = 500, align = 'left', baseline = 'alphabetic', letterSpacing = 0, alpha = 1 }) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${letterSpacing}px`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}
