import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Stage } from './core/Stage.js';
import { Emitter } from './core/Emitter.js';
import { Spring, damp } from './core/math.js';
import { LiquidBlob } from './world/LiquidBlob.js';
import { Backdrop } from './world/Backdrop.js';
import { ContactShadow } from './world/ContactShadow.js';
import { Pointer } from './interaction/Pointer.js';
import { ScrollDirector } from './interaction/ScrollDirector.js';
import { BlobInteraction } from './interaction/BlobInteraction.js';
import { Cursor } from './ui/Cursor.js';
import { Loader } from './ui/Loader.js';
import { Panels } from './ui/Panels.js';
import { SoundHooks } from './audio/SoundHooks.js';

const WORDS = ['Aether', 'Touch', 'Prism', 'One'];

// Per-section composition: blob position/scale, camera distance and roll.
const KEYS_DESKTOP = [
  { x: 0, y: 0.1, s: 1, z: 10, roll: 0 },
  { x: 1.3, y: 0, s: 0.86, z: 9.4, roll: -0.025 },
  { x: -1.3, y: 0.05, s: 0.9, z: 9.7, roll: 0.025 },
  { x: 0, y: 0.32, s: 0.74, z: 9, roll: 0 },
];
const KEYS_MOBILE = [
  { x: 0, y: 0.5, s: 0.9, z: 10, roll: 0 },
  { x: 0, y: 0.75, s: 0.78, z: 10, roll: -0.02 },
  { x: 0, y: 0.75, s: 0.8, z: 10, roll: 0.02 },
  { x: 0, y: 0.8, s: 0.7, z: 10, roll: 0 },
];

const media = {
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
  coarse: matchMedia('(pointer: coarse)').matches,
  get compact() { return this.coarse || window.innerWidth < 760; },
};

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

class App {
  constructor() {
    this.bus = new Emitter();
    this.motion = media.reduced ? 0.35 : 1;
    this.loader = new Loader(document.querySelector('.loader'), { reduced: media.reduced });
    this.scroll = new ScrollDirector({ count: WORDS.length, reduced: media.reduced, bus: this.bus });
    this.panels = new Panels({
      panels: [...document.querySelectorAll('[data-panel]')],
      progress: document.querySelector('.progress'),
      onSelect: (i) => this.scroll.goTo(i),
    });
    this.cursor = media.coarse ? null : new Cursor(document.querySelector('.cursor'), this.bus);
    this.sound = new SoundHooks(this.bus);

    this.center = new THREE.Vector3();
    this.camOffset = new THREE.Vector2();
    this.time = 0;
    this.reveal = 0;
    this.revealTarget = 0;
    this.intro = new Spring(0, media.reduced ? { stiffness: 200, damping: 30 } : { stiffness: 42, damping: 7.5 });
  }

  async init() {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);

    await Promise.race([
      document.fonts.load('italic 400 100px "Instrument Serif"').then(() => document.fonts.ready),
      new Promise((r) => setTimeout(r, 2500)), // never let a slow font block the reveal
    ]);
    this.loader.set(0.3);

    let webgl = supportsWebGL2();
    if (webgl) {
      try {
        await this.buildScene();
      } catch (err) {
        console.error('[Aether] WebGL scene failed, using fallback.', err);
        this.stage?.dispose();
        this.stage = null;
        webgl = false;
      }
    }

    if (webgl) {
      this.stage.start((dt, t) => this.update(dt, t));
    } else {
      document.documentElement.classList.add('no-webgl');
      this.runDomLoop();
    }

    await this.loader.finish(() => this.start());
  }

  async buildScene() {
    const stage = (this.stage = new Stage(document.querySelector('.webgl'), {
      maxDpr: media.compact ? 1.5 : 2,
    }));
    const { renderer, scene, camera } = stage;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose();
    pmrem.dispose();
    this.loader.set(0.55);
    await nextFrame();

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3, 5, 4);
    scene.add(key);

    this.backdrop = stage.add(new Backdrop({ camera, words: WORDS }));
    this.shadow = stage.add(new ContactShadow());
    this.blob = stage.add(new LiquidBlob({ detail: media.compact ? 22 : 52 }));
    this.blob.mesh.scale.setScalar(0.0001);

    this.pointer = new Pointer(this.bus);
    this.interaction = new BlobInteraction({
      camera,
      blob: this.blob,
      pointer: this.pointer,
      bus: this.bus,
      reduced: media.reduced,
    });

    this.bus.on('press', ({ target }) => {
      if (target.closest?.('a, button')) return;
      this.interaction.press();
    });
    // Narrative beat: each new chapter sends a wave through the glass from the direction of travel.
    this.bus.on('section', ({ direction }) => {
      this.interaction.rippleFrom(new THREE.Vector3(0, direction > 0 ? -1 : 1, 0.4).normalize(), 0.03);
    });

    await renderer.compileAsync(scene, camera);
    this.loader.set(0.9);
    renderer.render(scene, camera);
  }

  start() {
    const root = document.documentElement;
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
    this.intro.target = 1;
    this.revealTarget = 1;
    this.bus.emit('intro');
    if (this.interaction) {
      setTimeout(() => this.interaction.rippleFrom(new THREE.Vector3(0, 0.2, 1).normalize(), 0.06), 450);
    }
  }

  update(dt, t) {
    const { scroll, blob, interaction, stage } = this;
    const camera = stage.camera;

    this.pointer.update(dt);
    scroll.update(dt);
    const P = scroll.progress;
    const k = scroll.sample(media.compact ? KEYS_MOBILE : KEYS_DESKTOP);
    this.panels.update(P);
    this.cursor?.update(dt);

    // Composition
    const intro = Math.max(this.intro.update(dt), 0);
    const scale = Math.max(k.s * intro, 0.0001);
    this.center.set(k.x, k.y + Math.sin(t * 0.8) * 0.045 * this.motion, 0);
    interaction.update(dt, { center: this.center, scale });

    // Material life: time runs faster while the user is engaging or scrolling.
    const momentum = Math.min(scroll.momentum, 1);
    const between = Math.sin(Math.PI * (P - Math.floor(P)));
    this.time += dt * (0.6 + interaction.energy * 1.4 + momentum * 1.6) * this.motion;
    const u = blob.uniforms;
    u.uTime.value = this.time;
    u.uMorph.value = P;
    u.uNoiseAmp.value = (0.032 + interaction.energy * 0.045 + between * 0.03 + momentum * 0.05) * (0.6 + 0.4 * this.motion);

    // Camera: slow dolly per chapter, gentle parallax against the pointer.
    const p = this.pointer;
    const px = p.active ? p.ndc.x : 0;
    const py = p.active ? p.ndc.y : 0;
    this.camOffset.x = damp(this.camOffset.x, k.x * 0.18 - px * 0.14 * this.motion, 2.5, dt);
    this.camOffset.y = damp(this.camOffset.y, k.y * 0.2 - py * 0.1 * this.motion, 2.5, dt);
    const zFit = Math.max(k.z, 6 / camera.aspect);
    camera.position.set(this.camOffset.x, this.camOffset.y, damp(camera.position.z, zFit, 2.5, dt));
    camera.lookAt(k.x * 0.35, k.y * 0.5, 0);
    camera.rotateZ(k.roll);

    this.shadow.place(blob.mesh.position.x, k.y - 1.55 * k.s, 3.4 * scale, 0.2 * Math.min(intro, 1));

    this.reveal = damp(this.reveal, this.revealTarget, media.reduced ? 20 : 1.6, dt);
    this.backdrop.uniforms.uProgress.value = P;
    this.backdrop.uniforms.uReveal.value = this.reveal;
  }

  /** No-WebGL fallback: narrative panels still run on scroll. */
  runDomLoop() {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      this.scroll.update(dt);
      this.panels.update(this.scroll.progress);
      this.cursor?.update(dt);
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.stage?.dispose();
    this.pointer?.dispose();
    this.scroll.dispose();
    this.cursor?.dispose();
    this.sound.dispose();
    this.bus.clear();
  }
}

const app = new App();
app.init();
window.addEventListener('pagehide', (e) => {
  if (!e.persisted) app.dispose();
});
