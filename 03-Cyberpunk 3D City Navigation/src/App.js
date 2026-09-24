import * as THREE from 'three';
import { detectQuality, watchReducedMotion } from './config.js';
import { PROFILE, SECTIONS } from './content.js';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { World } from './world/World.js';
import { Input } from './interaction/Input.js';
import { Picker } from './interaction/Picker.js';
import { Cursor } from './ui/Cursor.js';
import { Loader } from './ui/Loader.js';
import { Hud } from './ui/Hud.js';
import { HoloPanel, renderBlocks } from './ui/HoloPanel.js';
import { SoundBus } from './audio/SoundBus.js';
import { clamp, damp } from './utils/math.js';

const SCROLL_TO_U = 0.00026;
// Opening shot: high above the avenue, then a long descending glide down to street level.
const INTRO_POSE = { position: new THREE.Vector3(0, 54, 84), look: new THREE.Vector3(0, 10, -40), ctrl: new THREE.Vector3(0, 7, 52) };

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

function loadFonts(timeout = 3000) {
  if (!document.fonts?.load) return Promise.resolve();
  const faces = ['900 64px "Unbounded"', '800 64px "Unbounded"', '300 64px "Unbounded"', '500 32px "JetBrains Mono"', '700 32px "JetBrains Mono"'];
  return Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, timeout))]);
}

// Orchestrates loading, the state machine (intro → path ⇄ flight ⇄ focus) and the frame loop.
export class App {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.state = 'loading';
    this.timer = new THREE.Timer();
    this.glitch = 0;
    this.hovered = null;
    this.focused = null;
    this.cleanups = [];
    this._proj = new THREE.Vector3();
  }

  async start() {
    const loader = (this.loader = new Loader(document.getElementById('loader')));
    if (!webglAvailable()) return this.#fallback(loader);

    try {
      this.quality = detectQuality();
      const rm = watchReducedMotion((v) => this.#setReducedMotion(v));
      this.reducedMotion = rm.value;
      this.cleanups.push(rm.stop);
      this.sound = new SoundBus();

      loader.progress(0.02, 'Handshake with district grid');
      this.renderer = new Renderer(this.canvas, this.quality);

      await loadFonts();
      loader.progress(0.1, 'Typefaces resolved');

      this.world = new World({ quality: this.quality, reducedMotion: this.reducedMotion, profile: PROFILE, sections: SECTIONS, sound: this.sound });
      await this.world.build((f, label) => loader.progress(0.1 + f * 0.75, label));

      this.rig = new CameraRig({ landmarks: this.world.landmarks, reducedMotion: this.reducedMotion, mobile: this.quality.mobile });
      this.camera = this.rig.camera;
      this.world.street.bindCamera(this.camera);
      this.renderer.setup(this.world.scene, this.camera);
      this.#placeIntroCamera();
      this.#bindUI();
      this.#resize();

      loader.progress(0.9, 'Compiling shaders');
      await this.renderer.compile();
      this.renderer.render(0);
      loader.progress(0.97, 'Warming the neon');

      this.timer.connect?.(document);
      this.renderer.renderer.setAnimationLoop(this.#tick);

      await loader.ready();
      this.#enter();
    } catch (err) {
      console.error(err);
      this.#fallback(loader);
    }
  }

  #placeIntroCamera() {
    this.camera.position.copy(INTRO_POSE.position);
    this.camera.lookAt(INTRO_POSE.look);
  }

  #bindUI() {
    const input = (this.input = new Input(this.canvas));
    this.picker = new Picker(this.world.pickables);
    this.cursor = new Cursor(document.getElementById('cursor'), { enabled: this.quality.finePointer });
    this.panel = new HoloPanel({
      root: document.getElementById('holo'),
      leader: document.getElementById('leader'),
      reducedMotion: this.reducedMotion,
      onClose: () => this.release(),
      onNav: (dir) => this.#nav(dir),
    });
    this.hud = new Hud(document.getElementById('hud'), {
      sections: SECTIONS,
      stops: this.rig.stops,
      touch: !this.quality.finePointer,
      onGoto: (i) => this.focusOn(this.world.landmarks[i]),
      onHome: () => this.home(),
      onSound: (on) => this.#setSound(on),
    });
    this.hud.setSound(false);

    input.on('scroll', (d) => this.#onScroll(d));
    input.on('first', () => this.hud.hideHint());
    input.on('tap', (p) => this.#onTap(p));
    input.on('escape', () => this.release());
    input.on('step', (dir) => this.#step(dir));
    input.on('goto', (i) => (i < 0 ? this.home() : this.world.landmarks[i] && this.focusOn(this.world.landmarks[i])));
    input.on('activate', () => {
      const i = this.rig.sectionIndexNear;
      if (this.state === 'path' && i >= 0) this.focusOn(this.world.landmarks[i]);
    });

    let resizeRaf = 0;
    const onResize = () => {
      cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => this.#resize());
    };
    window.addEventListener('resize', onResize);
    this.cleanups.push(() => window.removeEventListener('resize', onResize));

    const onVisibility = () => {
      if (!this.sound?.ctx) return;
      if (document.hidden) this.sound.ctx.suspend();
      else if (this.sound.enabled) this.sound.ctx.resume();
    };
    document.addEventListener('visibilitychange', onVisibility);
    this.cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  }

  #enter() {
    this.state = 'intro';
    if (this.sound.wanted) this.#setSound(true); // the Enter click is our user gesture
    this.sound.play('enter');
    this.loader.leave();
    setTimeout(() => this.world.title.show(), this.reducedMotion ? 0 : 900);
    const done = () => {
      this.state = 'path';
      this.input.enabled = true;
      this.hud.show();
    };
    setTimeout(() => this.hud.show(), this.reducedMotion ? 0 : 2600);
    this.rig.fly(this.rig.pathPoseAt(0), { duration: 4.8, ctrl: INTRO_POSE.ctrl, next: 'path', onDone: done });
  }

  // ─── Navigation ───────────────────────────────────────────────────────────

  focusOn(landmark) {
    if (!landmark || this.state === 'intro' || this.state === 'loading') return;
    if (this.focused === landmark && this.state !== 'path') return;
    const prev = this.focused;
    prev?.set('focus', false);
    this.panel.close();
    this.focused = landmark;
    landmark.set('focus', true);
    this.#setHover(null);

    const stop = this.rig.stops.find((s) => s.landmark === landmark);
    this.rig.progress = this.rig.target = stop.u;
    const pose = this.rig.focusPoseFor(landmark);

    this.state = 'flight';
    this.hud.setFocused(true);
    this.cursor.setBusy(true);
    this.glitch = this.reducedMotion ? 0 : 1;
    this.sound.play('select');
    this.sound.play('whoosh', { duration: 1.6 });
    this.rig.fly(pose, {
      arc: prev ? 5 : 1.5,
      next: 'focus',
      onDone: () => {
        this.state = 'focus';
        this.cursor.setBusy(false);
        const i = this.world.landmarks.indexOf(landmark);
        const n = SECTIONS.length;
        this.panel.open(landmark.section, {
          side: pose.panelSide,
          index: i,
          total: n,
          prevTitle: SECTIONS[(i - 1 + n) % n].title,
          nextTitle: SECTIONS[(i + 1) % n].title,
        });
        this.sound.play('open');
      },
    });
  }

  release() {
    if (!this.focused || this.state === 'flight') return;
    const landmark = this.focused;
    landmark.set('focus', false);
    this.focused = null;
    this.panel.close();
    this.sound.play('close');
    this.state = 'flight';
    this.cursor.setBusy(true);
    this.rig.fly(this.rig.pathPoseAt(this.rig.progress), {
      duration: 1.7,
      arc: 0.4,
      next: 'path',
      onDone: () => {
        this.state = 'path';
        this.hud.setFocused(false);
        this.cursor.setBusy(false);
      },
    });
  }

  home() {
    if (this.state === 'focus') this.release();
    this.rig.goTo(0);
  }

  #nav(dir) {
    const n = this.world.landmarks.length;
    const i = this.world.landmarks.indexOf(this.focused);
    this.focusOn(this.world.landmarks[(i + dir + n) % n]);
  }

  #step(dir) {
    if (this.state === 'focus') return this.#nav(dir);
    if (this.state !== 'path') return;
    const us = this.rig.stops.map((s) => s.u);
    const cur = this.rig.target;
    const next = dir > 0 ? us.find((u) => u > cur + 0.01) ?? 1 : [...us].reverse().find((u) => u < cur - 0.01) ?? 0;
    this.rig.goTo(next);
  }

  #onScroll(delta) {
    if (this.state === 'focus') {
      // scrolling away from a building walks you back out to the street
      if (Math.abs(delta) > 4) this.release();
      return;
    }
    if (this.state !== 'path') return;
    this.rig.scroll(delta * SCROLL_TO_U);
  }

  #onTap(p) {
    if (this.state !== 'path' && this.state !== 'focus') return;
    const hit = this.picker.pick(p.x, p.y, this.camera);
    if (hit) this.focusOn(hit);
    else if (this.state === 'focus' && p.type !== 'mouse') this.release();
  }

  #setHover(landmark) {
    if (landmark === this.hovered) return;
    this.hovered?.set('hover', false);
    this.hovered = landmark;
    if (landmark) {
      landmark.set('hover', true);
      this.sound.play('hover');
    }
    this.cursor.setTarget(landmark?.section ?? null, landmark && landmark === this.focused ? 'Viewing' : 'Enter');
    this.canvas.style.cursor = landmark && !this.quality.finePointer ? 'pointer' : '';
  }

  #setSound(on) {
    this.sound.setEnabled(on);
    this.hud.setSound(on);
    if (on) this.sound.play('tick');
  }

  #setReducedMotion(v) {
    this.reducedMotion = v;
    this.world?.setReducedMotion(v);
    if (this.rig) this.rig.reducedMotion = v;
    if (this.panel) this.panel.reducedMotion = v;
  }

  // ─── Frame ────────────────────────────────────────────────────────────────

  #resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.rig.setAspect(w / h);
    this.renderer.resize(w, h);
    this.world.street.setSize(w * this.renderer.dpr, h * this.renderer.dpr);
    this.world.setViewport(this.renderer.drawingHeight, this.rig.baseFov);
  }

  #tick = (time) => {
    this.timer.update(time);
    const dt = clamp(this.timer.getDelta(), 0, 1 / 20);
    const t = this.timer.getElapsed();
    const input = this.input;

    const pointer = input.pointer.type === 'mouse' && input.pointer.inside ? input.pointer : { x: 0, y: 0 };
    this.rig.update(dt, t, pointer);

    // Hover picking (mouse only; touch uses taps)
    if ((this.state === 'path' || this.state === 'focus') && input.pointer.type === 'mouse' && input.pointer.inside && input.pointer.overCanvas) {
      this.#setHover(this.picker.pick(input.pointer.x, input.pointer.y, this.camera));
    } else if (this.hovered) this.#setHover(null);

    const near = this.state === 'path' ? this.rig.sectionIndexNear : -1;
    this.world.landmarks.forEach((l, i) => l.set('near', i === near));

    this.world.update(dt, t, this.camera);

    if (this.state !== 'loading') this.hud.update(this.rig.progress, near, this.camera.position.z);
    if (this.focused && this.state === 'focus') this.panel.updateLeader(this.#project(this.focused.anchorPoint));

    this.glitch = damp(this.glitch, 0, 3.2, dt);
    this.renderer.glitch = this.glitch > 0.01 ? this.glitch * this.glitch : 0;
    this.sound.setMotion(this.rig.speed);

    this.renderer.render(t);
    if (this.renderer.adapt(dt)) this.#resize();
    this.cursor.update(dt);
  };

  #project(v) {
    const p = this._proj.copy(v).project(this.camera);
    const visible = p.z < 1 && Math.abs(p.x) < 1.05 && Math.abs(p.y) < 1.05;
    return { x: ((p.x + 1) / 2) * window.innerWidth, y: ((1 - p.y) / 2) * window.innerHeight, visible };
  }

  // ─── Fallback & teardown ─────────────────────────────────────────────────

  #fallback(loader) {
    loader?.fail?.('WebGL unavailable — switching to text mode');
    setTimeout(() => loader?.leave(), 600);
    const el = document.getElementById('fallback');
    el.innerHTML = `
      <h1>${PROFILE.name}</h1>
      <p>${PROFILE.role}. Your browser couldn't start the 3D district, so here is the same content in plain form.</p>
      ${SECTIONS.map((s) => `<section style="--accent:${s.color}"><h2>${s.index} — ${s.title}</h2>${renderBlocks(s.blocks)}</section>`).join('')}`;
    el.hidden = false;
    document.body.style.overflow = 'auto';
    this.canvas.remove();
  }

  dispose() {
    this.renderer?.renderer.setAnimationLoop(null);
    this.timer?.dispose?.();
    this.cleanups.forEach((c) => c());
    this.input?.dispose();
    this.cursor?.dispose();
    this.world?.dispose();
    this.renderer?.dispose();
    this.sound?.dispose();
  }
}
