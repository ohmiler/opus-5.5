import * as THREE from 'three';

// Procedural canvas textures. Everything is drawn at runtime: no image downloads.

export const PIXEL = '"Press Start 2P", monospace';
export const BODY = 'VT323, monospace';

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

export function toTexture(canvas, { pixel = false } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (pixel) { t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; }
  return t;
}

export function draw(w, h, fn, opts) {
  const c = makeCanvas(w, h);
  fn(c.getContext('2d'), w, h);
  return toTexture(c, opts);
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export const blobShadow = () =>
  draw(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(4,26,70,0.9)');
    g.addColorStop(0.45, 'rgba(4,26,70,0.35)');
    g.addColorStop(1, 'rgba(4,26,70,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });

export const sparkle = () =>
  draw(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.2, 'rgba(190,240,255,.6)');
    g.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.fillRect(31, 4, 2, 56); ctx.fillRect(4, 31, 56, 2);
  });

export const desk = () =>
  draw(2048, 1280, (ctx, w, h) => {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#f7fcff'); bg.addColorStop(0.55, '#e4f4ff'); bg.addColorStop(1, '#ffeefa');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    for (let x = 0; x <= w; x += 32) {
      ctx.fillStyle = x % 256 === 0 ? 'rgba(20,140,230,.32)' : 'rgba(20,140,230,.1)';
      ctx.fillRect(x, 0, x % 256 === 0 ? 2 : 1, h);
    }
    for (let y = 0; y <= h; y += 32) {
      ctx.fillStyle = y % 256 === 0 ? 'rgba(20,140,230,.32)' : 'rgba(20,140,230,.1)';
      ctx.fillRect(0, y, w, y % 256 === 0 ? 2 : 1);
    }
    // registration marks + tiny print for texture richness
    ctx.strokeStyle = 'rgba(10,60,130,.5)'; ctx.lineWidth = 3;
    for (const [x, y] of [[60, 60], [w - 60, 60], [60, h - 60], [w - 60, h - 60]]) {
      ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y); ctx.moveTo(x, y - 30); ctx.lineTo(x, y + 30); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(10,60,130,.45)'; ctx.font = `16px ${PIXEL}`;
    ctx.fillText('DESKTOP.SYS  0x2000  ◆  ALT-COMPUTING', 100, 70);
    ctx.textAlign = 'right'; ctx.fillText('SURFACE: TRANSLUCENT / GRID 32PX', w - 100, h - 52);
  });

export const deskTitle = () =>
  draw(2048, 440, (ctx, w, h) => {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `150px ${PIXEL}`;
    const g = ctx.createLinearGradient(0, 40, 0, 230);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.45, '#9fdcff'); g.addColorStop(0.5, '#1c7fd8'); g.addColorStop(0.75, '#bfeaff'); g.addColorStop(1, '#ffffff');
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22; ctx.strokeStyle = 'rgba(4,30,80,.9)'; ctx.strokeText('MILLENNIUM', w / 2, 140);
    ctx.fillStyle = g; ctx.fillText('MILLENNIUM', w / 2, 140);
    ctx.font = `44px ${PIXEL}`;
    ctx.fillStyle = 'rgba(8,50,110,.85)';
    ctx.fillText('OS  ✦  v2.000  ✦  ALTERNATE EDITION', w / 2, 300);
    ctx.font = `52px ${BODY}`; ctx.fillStyle = 'rgba(8,50,110,.55)';
    ctx.fillText('drag  ·  throw  ·  double-click  ·  type  ·  explore', w / 2, 385);
  });

export function label(text) {
  const font = `26px ${PIXEL}`;
  const c = makeCanvas(8, 8);
  let ctx = c.getContext('2d');
  ctx.font = font;
  const tw = Math.ceil(ctx.measureText(text).width);
  c.width = tw + 44; c.height = 60;
  ctx = c.getContext('2d');
  rr(ctx, 2, 2, c.width - 4, c.height - 4, 26);
  ctx.fillStyle = 'rgba(4,30,72,.72)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; ctx.stroke();
  ctx.font = font; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(text, 22, 33);
  return { texture: toTexture(c), aspect: c.width / c.height };
}

export const cd = (title, hue) =>
  draw(512, 512, (ctx) => {
    const cx = 256;
    const base = ctx.createRadialGradient(cx, cx, 40, cx, cx, 256);
    base.addColorStop(0, '#f4f9ff'); base.addColorStop(1, '#c9d6e6');
    ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);
    if (ctx.createConicGradient) {
      const cg = ctx.createConicGradient(0.6, cx, cx);
      ['#ffd6f5', '#d6f3ff', '#fffbd0', '#d8ffe9', '#e6d8ff', '#ffd6f5'].forEach((c, i, a) => cg.addColorStop(i / (a.length - 1), c));
      ctx.globalAlpha = 0.55; ctx.fillStyle = cg; ctx.fillRect(0, 0, 512, 512); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    for (let r = 90; r < 250; r += 3) { ctx.beginPath(); ctx.arc(cx, cx, r, 0, Math.PI * 2); ctx.stroke(); }
    // printed label arc
    ctx.beginPath(); ctx.arc(cx, cx, 240, Math.PI * 1.05, Math.PI * 1.95); ctx.arc(cx, cx, 150, Math.PI * 1.95, Math.PI * 1.05, true); ctx.closePath();
    ctx.fillStyle = `hsla(${hue},95%,62%,.85)`; ctx.fill();
    ctx.save(); ctx.translate(cx, cx);
    ctx.font = `20px ${PIXEL}`; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    const chars = title.split('');
    const span = 0.08;
    chars.forEach((ch, i) => {
      ctx.save(); ctx.rotate((i - (chars.length - 1) / 2) * span); ctx.fillText(ch, 0, -186); ctx.restore();
    });
    ctx.font = `28px ${BODY}`; ctx.fillStyle = 'rgba(10,30,70,.7)';
    ctx.fillText('700 MB · 80 MIN · DIGITAL AUDIO', 0, 200);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cx, 72, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
  });

export const floppyLabel = (title, sub, stripe) =>
  draw(320, 184, (ctx, w, h) => {
    ctx.fillStyle = '#fbfdff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = stripe; ctx.fillRect(0, 0, w, 26);
    ctx.strokeStyle = 'rgba(40,90,160,.25)'; ctx.lineWidth = 2;
    for (let y = 70; y < h; y += 30) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(w - 14, y); ctx.stroke(); }
    ctx.fillStyle = '#16305e'; ctx.font = `18px ${PIXEL}`; ctx.fillText(title, 16, 62);
    ctx.font = `30px ${BODY}`; ctx.fillStyle = '#c21d8f'; ctx.fillText(sub, 16, 120);
    ctx.fillStyle = 'rgba(22,48,94,.5)'; ctx.fillText('1.44 MB  HD', 16, 160);
  });

export const paper = () =>
  draw(256, 200, (ctx, w, h) => {
    ctx.fillStyle = '#fbfdff'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(40,120,220,.22)';
    for (let y = 30; y < h; y += 18) ctx.fillRect(18, y, w - 36 - ((y * 7) % 60), 5);
  });

export const sticky = (lines, color) =>
  draw(256, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, color); g.addColorStop(1, shade(color));
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0,0,0,.06)'; ctx.fillRect(0, 0, w, 34);
    ctx.fillStyle = '#1a2a55'; ctx.font = `36px ${BODY}`;
    lines.forEach((l, i) => ctx.fillText(l, 18, 78 + i * 38));
  });

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.round(v * 0.86));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

export function windowFace(kind) {
  return draw(768, 512, (ctx, w, h) => {
    rr(ctx, 4, 4, w - 8, h - 8, 26);
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, 'rgba(250,253,255,.97)'); bg.addColorStop(1, 'rgba(222,242,255,.95)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); ctx.clip();
    const bar = ctx.createLinearGradient(0, 0, 0, 64);
    const pink = kind === 'error';
    bar.addColorStop(0, pink ? '#ffe0f6' : '#d4f1ff'); bar.addColorStop(0.48, pink ? '#ff8ade' : '#7fd0ff');
    bar.addColorStop(0.52, pink ? '#e5439f' : '#34a9f3'); bar.addColorStop(1, pink ? '#ff9ce4' : '#8fdcff');
    ctx.fillStyle = bar; ctx.fillRect(0, 0, w, 64);
    ['#ff5b47', '#ffc42e', '#39c52a'].forEach((c, i) => {
      ctx.beginPath(); ctx.arc(40 + i * 36, 32, 11, 0, Math.PI * 2); ctx.fillStyle = c; ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(40 + i * 36, 28, 4, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = '#fff'; ctx.font = `20px ${PIXEL}`; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,40,100,.6)'; ctx.shadowOffsetY = 2;
    ctx.fillText(pink ? 'error.exe' : 'welcome.txt', w / 2, 42);
    ctx.shadowColor = 'transparent'; ctx.textAlign = 'left';
    ctx.fillStyle = '#0a2a55';
    if (pink) {
      ctx.beginPath(); ctx.moveTo(90, 130); ctx.lineTo(150, 230); ctx.lineTo(30, 230); ctx.closePath();
      ctx.fillStyle = '#ffd23a'; ctx.fill(); ctx.strokeStyle = '#0a2a55'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#0a2a55'; ctx.font = `44px ${PIXEL}`; ctx.fillText('!', 74, 218);
      ctx.font = `22px ${PIXEL}`; ctx.fillText('ERROR 2000', 190, 150);
      ctx.font = `44px ${BODY}`;
      ['Too much fun detected.', 'Continue anyway?'].forEach((l, i) => ctx.fillText(l, 190, 210 + i * 44));
      rr(ctx, w / 2 - 90, 360, 180, 70, 35);
      const b = ctx.createLinearGradient(0, 360, 0, 430);
      b.addColorStop(0, '#bdeaff'); b.addColorStop(0.5, '#1591ea'); b.addColorStop(1, '#6fd2ff');
      ctx.fillStyle = b; ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = `22px ${PIXEL}`; ctx.textAlign = 'center'; ctx.fillText('OK', w / 2, 406);
    } else {
      ctx.font = `26px ${PIXEL}`; ctx.fillStyle = '#0b7fe0'; ctx.fillText('Hello, visitor!', 40, 130);
      ctx.font = `42px ${BODY}`; ctx.fillStyle = '#0a2a55';
      ['Welcome to the year 2000', 'that never happened.', '', '> click me to read more', '> psst… there are 5 secrets'].forEach((l, i) =>
        ctx.fillText(l, 40, 196 + i * 50));
    }
    ctx.restore();
  });
}
