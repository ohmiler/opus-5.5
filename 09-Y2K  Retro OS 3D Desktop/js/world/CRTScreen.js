import * as THREE from 'three';
import { makeCanvas, toTexture, PIXEL, BODY } from './textures.js';

const MOODS = ['happy', 'wow', 'wink', 'love', 'dizzy'];
const REPLIES = {
  help: ['TRY: HELLO, DIR, TIME,', 'PARTY, CLEAR... OR SECRETS'],
  hello: ['HI!! :)  NICE CURSOR'],
  hi: ['HELLO, HUMAN FROM 2026?'],
  dir: ['ABOUT  PROJECTS  MIXTAPE', 'GUESTBK  SECRET.FLP (?)'],
  time: () => [new Date().toLocaleTimeString()],
  party: ['*** PARTY MODE ***', '(TRY THE KONAMI CODE)'],
  secrets: ['NICE TRY. KEEP LOOKING.'],
  sudo: ['NICE TRY, ADMIN.'],
  win: ['YOU ARE WINNER!'],
};

/** Tiny retro terminal rendered into a canvas texture on the CRT. */
export class CRTScreen {
  constructor() {
    this.canvas = makeCanvas(320, 240);
    this.ctx = this.canvas.getContext('2d');
    this.texture = toTexture(this.canvas, { pixel: true });
    this.lines = ['MILLENNIUM OS v2.000', 'TYPE ANYTHING. TRY "HELP"'];
    this.input = '';
    this.mood = 'happy';
    this.moodTimer = 0;
    this.glitch = 0;
    this.accum = 1;
    this.blink = 0;
    this.lookX = 0;
  }

  nextMood() {
    const i = (MOODS.indexOf(this.mood) + 1) % MOODS.length;
    this.setMood(MOODS[i], 2.5);
  }

  setMood(m, hold = 1.5) { this.mood = m; this.moodTimer = hold; this.accum = 1; }

  /** Returns the submitted command when Enter is pressed. */
  type(key) {
    let submitted = null;
    if (key === 'Backspace') this.input = this.input.slice(0, -1);
    else if (key === 'Enter') {
      submitted = this.input.trim().toLowerCase();
      this.lines.push('>' + this.input.toUpperCase());
      if (submitted === 'clear') this.lines = [];
      else if (submitted) {
        const r = REPLIES[submitted];
        const out = typeof r === 'function' ? r() : r || ['BAD COMMAND OR FILE NAME'];
        this.lines.push(...out);
        this.setMood(r ? 'happy' : 'dizzy', 1.6);
      }
      this.input = '';
    } else if (key.length === 1 && this.input.length < 22) {
      this.input += key;
      if (this.mood !== 'wow') this.setMood('wow', 0.5);
    }
    this.lines = this.lines.slice(-4);
    this.accum = 1;
    return submitted;
  }

  print(...lines) { this.lines.push(...lines); this.lines = this.lines.slice(-4); this.accum = 1; }

  update(dt, t) {
    this.moodTimer -= dt;
    if (this.moodTimer <= 0 && this.mood !== 'happy') { this.mood = 'happy'; this.accum = 1; }
    this.glitch = Math.max(0, this.glitch - dt);
    this.accum += dt;
    if (this.accum < 1 / 12) return;
    this.accum = 0;
    this.render(t);
  }

  render(t) {
    const { ctx } = this;
    const W = 320, H = 240;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#062b5c'); g.addColorStop(1, '#021634');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // face
    const cx = 160 + this.lookX * 14, cy = 78;
    const blinking = (t % 4.2) < 0.13 && this.mood !== 'wink';
    ctx.fillStyle = '#8ff0ff';
    const px = (x, y, w, h) => ctx.fillRect(Math.round(x), Math.round(y), w, h);
    const eye = (x, closed) => (closed ? px(x - 10, cy, 20, 4) : px(x - 7, cy - 12, 14, 22));
    if (this.mood === 'love') {
      ctx.fillStyle = '#ff7ad9';
      for (const ex of [cx - 40, cx + 40]) { px(ex - 12, cy - 10, 10, 8); px(ex + 2, cy - 10, 10, 8); px(ex - 12, cy - 4, 24, 8); px(ex - 8, cy + 4, 16, 6); px(ex - 4, cy + 10, 8, 4); }
      ctx.fillStyle = '#8ff0ff';
    } else if (this.mood === 'dizzy') {
      ctx.font = `22px ${PIXEL}`; ctx.textAlign = 'center';
      ctx.fillText('@', cx - 40, cy + 10); ctx.fillText('@', cx + 40, cy + 10);
    } else {
      eye(cx - 40, blinking);
      eye(cx + 40, blinking || this.mood === 'wink');
    }
    // mouth
    if (this.mood === 'wow' || this.mood === 'dizzy') { px(cx - 10, cy + 30, 20, 4); px(cx - 14, cy + 34, 4, 12); px(cx + 10, cy + 34, 4, 12); px(cx - 10, cy + 46, 20, 4); }
    else { px(cx - 30, cy + 30, 6, 6); px(cx - 24, cy + 36, 48, 6); px(cx + 24, cy + 30, 6, 6); }

    // text
    ctx.textAlign = 'left';
    ctx.font = `22px ${BODY}`;
    ctx.fillStyle = '#bff6ff';
    this.lines.forEach((l, i) => ctx.fillText(l.slice(0, 30), 14, 150 + i * 18));
    const cursor = Math.floor(t * 2) % 2 ? '_' : ' ';
    ctx.fillStyle = '#c6ff4d';
    ctx.fillText('C:\\>' + this.input.toUpperCase() + cursor, 14, 150 + 4 * 18);

    if (this.glitch > 0) {
      for (let i = 0; i < 10; i++) {
        const y = Math.random() * H, h = 4 + Math.random() * 16;
        ctx.drawImage(this.canvas, 0, y, W, h, (Math.random() - 0.5) * 40, y, W, h);
      }
      ctx.fillStyle = `rgba(255,${Math.random() * 120},200,.18)`; ctx.fillRect(0, 0, W, H);
    }

    // scanlines + vignette
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
    const v = ctx.createRadialGradient(W / 2, H / 2, 60, W / 2, H / 2, 210);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    this.texture.needsUpdate = true;
  }

  dispose() { this.texture.dispose(); }
}

export const SCREEN_GEOMETRY = () => {
  // Slightly bulged plane for that CRT curvature.
  const geo = new THREE.PlaneGeometry(1.56, 1.17, 16, 12);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / 0.78, y = p.getY(i) / 0.585;
    p.setZ(i, 0.06 * (1 - (x * x + y * y) * 0.5));
  }
  geo.computeVertexNormals();
  return geo;
};
