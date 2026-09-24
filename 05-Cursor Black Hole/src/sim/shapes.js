/*
 * CPU-side seed data for the simulation. Everything here is generated once (or on resize for the
 * word) and uploaded as RGBA float textures, one texel per body.
 */

const TAU = Math.PI * 2;

function gaussian() {
  let u = 0;
  while (u === 0) u = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * Math.random());
}

/** Four independent uniforms per body; the shaders derive every per-particle variation from these. */
export function createRandomData(count) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.random();
  return data;
}

/** Resting positions for the opening chapter: a meandering river of matter plus loose dust. */
export function createHomeField(count) {
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    if (Math.random() < 0.68) {
      const x = (Math.random() * 2 - 1) * 12;
      data[o] = x;
      data[o + 1] = gaussian() * 1.35 + Math.sin(x * 0.32 + 0.6) * 1.4 - x * 0.08;
      data[o + 2] = gaussian() * 1.4 - 1.5;
    } else {
      data[o] = (Math.random() * 2 - 1) * 13;
      data[o + 1] = (Math.random() * 2 - 1) * 7.5;
      data[o + 2] = -7 + Math.random() * 9;
    }
    data[o + 3] = 1;
  }
  return data;
}

/**
 * Initial state. With motion: every body starts inside a single point and is flung outward —
 * the loader collapses into that point and the scene is born from it.
 */
export function createInitialState(count, rand, home, { bigBang }) {
  const position = new Float32Array(count * 4);
  const velocity = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const o = i * 4;
    position[o + 3] = rand[o]; // seed, read by the renderer
    if (!bigBang) {
      position[o] = home[o];
      position[o + 1] = home[o + 1];
      position[o + 2] = home[o + 2];
      continue;
    }
    const z = rand[o + 1] * 2 - 1;
    const t = rand[o + 2] * TAU;
    const s = Math.sqrt(1 - z * z);
    const dx = s * Math.cos(t);
    const dy = s * Math.sin(t);
    const r = 0.04 * Math.cbrt(rand[o + 3]);
    position[o] = dx * r;
    position[o + 1] = dy * r;
    position[o + 2] = z * r;
    const speed = 2 + Math.pow(Math.random(), 1.6) * 16;
    velocity[o] = dx * speed;
    velocity[o + 1] = dy * speed * 0.8;
    velocity[o + 2] = z * speed * 0.6;
  }
  return { position, velocity };
}

/**
 * Samples a word set in the headline face into world-space points, `worldWidth` units wide.
 * Falls back to a ring if the font can't render (e.g. canvas blocked).
 */
export function createWordTargets(word, count, worldWidth) {
  const cw = 1024;
  const ch = 512;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const out = new Float32Array(count * 4);

  const family = '"Instrument Serif", "Iowan Old Style", Georgia, serif';
  let size = 380;
  ctx.font = `italic 400 ${size}px ${family}`;
  const measured = ctx.measureText(word).width || 1;
  size = Math.min((size * cw * 0.8) / measured, ch * 0.8);
  ctx.font = `italic 400 ${size}px ${family}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  ctx.fillText(word, cw / 2, ch / 2);

  const img = ctx.getImageData(0, 0, cw, ch).data;
  const pts = [];
  let minX = cw, maxX = 0, minY = ch, maxY = 0;
  for (let y = 0; y < ch; y += 2) {
    for (let x = 0; x < cw; x += 2) {
      if (img[(y * cw + x) * 4 + 3] > 128) {
        pts.push(x, y);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  canvas.width = canvas.height = 0; // release the backing store

  if (pts.length === 0) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * TAU;
      const rr = worldWidth * 0.3 * (0.9 + Math.random() * 0.2);
      out.set([Math.cos(a) * rr, Math.sin(a) * rr, (Math.random() - 0.5) * 0.3, 1], i * 4);
    }
    return out;
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = worldWidth / Math.max(1, maxX - minX);
  const n = pts.length / 2;
  for (let i = 0; i < count; i++) {
    const j = ((Math.random() * n) | 0) * 2;
    const o = i * 4;
    out[o] = (pts[j] - cx + (Math.random() * 2 - 1)) * scale;
    out[o + 1] = -(pts[j + 1] - cy + (Math.random() * 2 - 1)) * scale;
    out[o + 2] = (Math.random() - 0.5) * 0.3;
    out[o + 3] = 1;
  }
  return out;
}
