import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { ParticleSimulation } from './sim/ParticleSimulation.js';
import { ParticleField } from './sim/ParticleField.js';
import { createHomeField, createRandomData, createWordTargets } from './sim/shapes.js';
import { Pointer } from './interaction/Pointer.js';
import { Cursor } from './ui/Cursor.js';
import { LensText } from './ui/LensText.js';
import { CHAPTERS, FABRIC_Y, PARTICLE_WORD } from './config/chapters.js';
import { clamp, easeInOutCubic, lerp, smoothstep } from './utils/math.js';

// Yield so the loader can paint — but don't stall in a background tab, where rAF is paused.
const nextFrame = () => new Promise((r) => {
  requestAnimationFrame(() => r());
  setTimeout(r, 50);
});
const REFERENCE_DISTANCE = 12; // camera distance used to lay forms out beside the text

/** Wires scene, camera, simulation, input and UI together and owns the frame loop. */
export class App {
  constructor({ canvas, cursorEl, device, bus, hud, narrative, lensGroups }) {
    this.canvas = canvas;
    this.cursorEl = cursorEl;
    this.device = device;
    this.bus = bus;
    this.hud = hud;
    this.narrative = narrative;
    this.lensGroups = lensGroups;

    this.reducedMotion = device.reducedMotion;
    this.running = false;
    this.time = 0;
    this.intro = this.reducedMotion ? 1 : 0;
    this.reveal = 0;

    this.layout = { offsets: CHAPTERS.map(() => new THREE.Vector3()), scale: 1, wordWidth: 7 };
    this._viewDir = new THREE.Vector3();
    this._perf = { time: 0, frames: 0, downgrades: 0 };
    this._unsubscribe = [];
  }

  get count() {
    return this.device.simSize ** 2;
  }

  async init(progress) {
    const { device } = this;
    this.renderer = new Renderer(this.canvas, { maxDpr: device.maxDpr });
    this.scene = new THREE.Scene();
    this.rig = new CameraRig(CHAPTERS, { reducedMotion: this.reducedMotion });
    this._layout();

    progress(0.1, `Seeding ${this.count.toLocaleString('en-US')} bodies`);
    await nextFrame();
    const rand = createRandomData(this.count);
    const home = createHomeField(this.count);
    const word = createWordTargets(PARTICLE_WORD, this.count, this.layout.wordWidth);
    this._wordWidth = this.layout.wordWidth;

    progress(0.4, 'Compiling gravity');
    await nextFrame();
    this.sim = new ParticleSimulation(this.renderer.gl, {
      size: device.simSize,
      rand,
      home,
      word,
      bigBang: !this.reducedMotion,
    });
    this.field = new ParticleField(device.simSize, { pixelRatio: this.renderer.pixelRatio });
    this.scene.add(this.field.points);

    this.pointer = new Pointer({ bus: this.bus, coarse: device.coarse, reducedMotion: this.reducedMotion });
    this.cursor = device.coarse ? null : new Cursor(this.cursorEl, this.pointer, this.bus, { reducedMotion: this.reducedMotion });
    this.lens = new LensText(this.lensGroups, { reducedMotion: this.reducedMotion });

    progress(0.75, 'Warming shaders');
    await nextFrame();
    this.field.update(this.sim, this.pointer.world, 0);
    await this.renderer.gl.compileAsync(this.scene, this.rig.camera);
    this.renderer.render(this.scene, this.rig.camera);

    this._listen();
    progress(1, 'Ready');
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this._raf);
  }

  setReducedMotion(on) {
    this.reducedMotion = on;
    this.rig.reducedMotion = on;
    this.pointer.reducedMotion = on;
    this.narrative.reducedMotion = on;
    if (this.cursor) this.cursor.reducedMotion = on;
    this.lens.setEnabled(!on);
  }

  _listen() {
    const on = (target, type, fn, opts) => {
      target.addEventListener(type, fn, opts);
      this._unsubscribe.push(() => target.removeEventListener(type, fn, opts));
    };

    on(window, 'resize', () => (this._resizePending = true));
    on(document, 'visibilitychange', () => {
      if (!document.hidden) this._last = performance.now();
    });
    on(window, 'pagehide', (e) => {
      if (!e.persisted) this.dispose();
    });
    on(this.canvas, 'webglcontextlost', (e) => {
      e.preventDefault();
      this.stop();
      document.body.classList.add('is-fallback');
    });

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    on(motion, 'change', (e) => this.setReducedMotion(e.matches));

    this._unsubscribe.push(this.bus.on('detonate', (d) => this._detonate(d)));
  }

  /** Compose each chapter's form beside its text; on portrait screens, above it. */
  _layout() {
    const w = innerWidth;
    const h = innerHeight;
    const aspect = w / h;
    this.renderer.resize(w, h);
    this.rig.resize(aspect);
    this.field?.setPixelRatio(this.renderer.pixelRatio);

    const portrait = aspect < 0.95;
    const hh = Math.tan(THREE.MathUtils.degToRad(this.rig.camera.fov / 2)) * REFERENCE_DISTANCE;
    const hw = hh * aspect;
    this.layout.scale = portrait ? clamp(aspect * 1.05, 0.6, 0.9) : 1;
    CHAPTERS.forEach((ch, i) => {
      this.layout.offsets[i].set(
        portrait ? 0 : ch.side * hw * 0.4,
        ch.lift + (portrait && ch.side !== 0 ? hh * 0.22 : 0),
        0,
      );
    });
    this.layout.wordWidth = Math.min(hw * 2 * (portrait ? 0.78 : 0.5), 9);

    // Re-set the word only when the size really changed, and not on every resize event.
    if (this.sim && Math.abs(this.layout.wordWidth - this._wordWidth) / this._wordWidth > 0.08) {
      clearTimeout(this._wordTimer);
      this._wordTimer = setTimeout(() => {
        this._wordWidth = this.layout.wordWidth;
        this.sim?.setWord(createWordTargets(PARTICLE_WORD, this.count, this._wordWidth));
      }, 300);
    }
  }

  _detonate(d) {
    const k = this.reducedMotion ? 0.55 : 1;
    this.sim.burst(this.pointer.world, d.strength * k, d.radius, d.spin * k);
    this.lens.kick(d.x, d.y, d.power * k);
    this.cursor?.shock(d);
  }

  _tick = (now) => {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);

    if (this._resizePending) {
      this._resizePending = false;
      this._layout();
    }

    const dt = Math.min((now - this._last) / 1000, 1 / 30);
    this._last = now;
    if (dt <= 0) return;
    this.time += dt;

    const { narrative, pointer, rig, sim, layout } = this;
    const reduced = this.reducedMotion;

    narrative.update(dt);
    const n = CHAPTERS.length;
    const chapter = clamp(narrative.chapter, 0, n - 1);
    const a = Math.min(Math.floor(chapter), n - 1);
    const b = Math.min(a + 1, n - 1);
    const blend = a === b ? 0 : smoothstep(0.18, 0.82, chapter - a);
    const A = CHAPTERS[a];
    const B = CHAPTERS[b];

    rig.update(dt, chapter, pointer.ndcSmooth, this.time);
    pointer.groundY = layout.offsets[3].y + FABRIC_Y * layout.scale;
    pointer.update(dt, rig.camera, rig.focus, this.time);

    // Intro: springs start slack so the opening burst can travel, then tighten into the drift.
    this.intro = Math.min(1, this.intro + dt / 3.2);
    this.reveal = Math.min(1, this.reveal + dt / (reduced ? 0.8 : 0.35));
    const settle = 0.06 + 0.94 * easeInOutCubic(this.intro);

    rig.camera.getWorldDirection(this._viewDir);
    sim.step(dt, {
      time: this.time,
      pointer,
      viewDir: this._viewDir,
      shapeA: A.shape,
      shapeB: B.shape,
      blend,
      pinch: reduced ? 0 : B.pinch,
      stiffness: lerp(A.stiffness, B.stiffness, blend) * settle,
      flow: lerp(A.flow, B.flow, blend) * (reduced ? 0.35 : 1) + Math.min(Math.abs(narrative.velocity), 3) * 0.5,
      scrollVel: reduced ? 0 : narrative.velocity,
      offsetA: layout.offsets[a],
      offsetB: layout.offsets[b],
      scale: layout.scale,
    });

    this.field.update(sim, pointer.world, this.reveal);
    this.renderer.render(this.scene, rig.camera);

    this.cursor?.update(dt);
    this.lens.update(dt, pointer);
    this.hud.setMass(pointer.mass);
    this.hud.setState(pointer.state);
    this.hud.setLevel(pointer.presence * 0.25 + pointer.chargeEased * 0.75);
    this.bus.emit('field', { presence: pointer.presence, charge: pointer.chargeEased });

    this._monitor(dt);
  };

  /** If frames run long after the intro, trade resolution for smoothness. */
  _monitor(dt) {
    if (this.intro < 1) return;
    const p = this._perf;
    p.time += dt;
    p.frames++;
    if (p.time < 2) return;
    const avg = p.time / p.frames;
    if (avg > 1 / 45 && p.downgrades < 3 && this.renderer.degrade()) {
      p.downgrades++;
      this.field.setPixelRatio(this.renderer.pixelRatio);
    }
    p.time = 0;
    p.frames = 0;
  }

  dispose() {
    this.stop();
    clearTimeout(this._wordTimer);
    this._unsubscribe.forEach((fn) => fn());
    this._unsubscribe = [];
    this.pointer?.dispose();
    this.cursor?.dispose();
    this.lens?.dispose();
    this.sim?.dispose();
    this.field?.dispose();
    this.scene?.clear();
    this.renderer?.dispose();
    this.sim = this.field = null;
  }
}
