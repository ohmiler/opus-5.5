import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { Stage } from './core/Stage.js';
import { CameraRig } from './core/CameraRig.js';
import { Gallery } from './gallery/Gallery.js';
import { projects } from './gallery/projects.js';
import { Input } from './interaction/Input.js';
import { Cursor } from './ui/Cursor.js';
import { Loader } from './ui/Loader.js';
import { HUD } from './ui/HUD.js';
import { Detail } from './ui/Detail.js';
import { SoundEngine } from './audio/SoundEngine.js';
import { env } from './utils/env.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Wires the independent systems together and owns the state machine:
//   loading → intro → explore ⇄ focus
export class App {
  constructor(dom) {
    this.dom = dom;
    this.state = 'loading';
    this.time = 0;
    this.hovered = null;
    this.focused = null;
    this.noPointer = new THREE.Vector2(0, 0);

    this.renderer = new Renderer(dom.stage);
    this.stage = new Stage();
    this.rig = new CameraRig();
    this.gallery = new Gallery(this.stage);
    this.sound = new SoundEngine();
    this.loader = new Loader(dom.loader);
    this.cursor = new Cursor(dom.cursor);
    this.input = new Input(this.renderer.domElement, this.rig);
    this.hud = new HUD(dom.hud, {
      projects,
      onSelect: (i) => this.open(this.gallery.cards[i]),
      onSoundToggle: () => this.sound.toggle(),
    });
    this.detail = new Detail(dom.detail, {
      total: projects.length,
      onClose: () => this.close(),
      onStep: (dir) => this.step(dir),
    });

    this._bindInput();
    this._onResize = this._onResize.bind(this);
    this._onPop = this._onPop.bind(this);
    this._onVisibility = () => (this._last = performance.now());
    window.addEventListener('resize', this._onResize);
    window.addEventListener('popstate', this._onPop);
    document.addEventListener('visibilitychange', this._onVisibility);
    this._onResize();
  }

  async start() {
    this._last = performance.now();
    this._raf = requestAnimationFrame(this._loop);

    this.loader.set(0.04, 'Setting the type');
    await loadFonts();
    this.loader.set(0.14, 'Hanging the works');
    await this.gallery.build((p) => this.loader.set(0.14 + p * 0.76, 'Hanging the works'));
    this.gallery.setViewport(this.rig.aspect);

    this.loader.set(0.93, 'Lighting the rooms');
    this.rig.playIntro(); // place the camera at the intro pose before compiling
    this.rig.update(0);
    this.renderer.compile(this.stage.scene, this.rig.camera);
    await new Promise((r) => requestAnimationFrame(r));

    await this.loader.finish();
    this.state = 'intro';
    this.rig.playIntro();
    this.gallery.reveal(this.time);
    setTimeout(() => this.hud.show(), env.reducedMotion ? 0 : 1400);
    setTimeout(() => {
      if (this.state !== 'intro') return;
      this.state = 'explore';
      this._openFromUrl();
    }, env.reducedMotion ? 200 : 2600);
  }

  // ---- Interactions -------------------------------------------------------

  _bindInput() {
    const input = this.input;
    input.on('tap', ({ ndc }) => {
      if (this.state === 'explore') {
        const card = this.gallery.pick(ndc, this.rig.camera);
        if (card) this.open(card);
      } else if (this.state === 'focus') {
        this.close();
      }
    });
    input.on('dragstart', () => {
      this.dom.root.classList.add('is-dragging');
      this.hud.dismissHint();
    });
    input.on('dragend', () => this.dom.root.classList.remove('is-dragging'));
    input.on('travel', () => this.hud.dismissHint());
    input.on('key', ({ key, event }) => {
      if (this.state !== 'focus') return;
      if (key === 'Escape') this.close();
      else if (key === 'ArrowRight' || key === 'ArrowDown') { event.preventDefault(); this.step(1); }
      else if (key === 'ArrowLeft' || key === 'ArrowUp') { event.preventDefault(); this.step(-1); }
    });
  }

  open(card, { push = true } = {}) {
    if (!card || this.state === 'loading') return;
    if (this.state === 'focus') {
      if (card !== this.focused) this._goTo(card, card.framing);
      return;
    }
    this.state = 'focus';
    this.focused = card;
    this._setHover(null);
    this.input.locked = true;
    this.gallery.focus(card);
    this.rig.focusOn(card.framing, { duration: 1.8, fovKick: 10 });
    this.detail.show(card, env.reducedMotion ? 150 : 1150);
    this.hud.setHidden(true);
    this.cursor.set('close', 'Close');
    this.dom.root.classList.add('is-focus');
    this.sound.play('open');
    this._pushed = push;
    if (push) history.pushState({ project: card.index }, '', `#/${slug(card.project.title)}`);
  }

  step(dir) {
    if (this.state !== 'focus' || this.rig.inTransition) return;
    const { card, framing } = this.gallery.neighbour(this.focused, dir);
    this._goTo(card, framing);
    history.replaceState({ project: card.index }, '', `#/${slug(card.project.title)}`);
  }

  _goTo(card, framing) {
    this.focused = card;
    this.gallery.focus(card);
    this.rig.focusOn(framing, { duration: 1.6, fovKick: 14 });
    this.detail.swap(card, env.reducedMotion ? 300 : 1100);
    this.sound.play('step');
  }

  close({ pop = false } = {}) {
    if (this.state !== 'focus') return;
    this.state = 'closing';
    const card = this.focused;
    this.focused = null;
    this.detail.hide();
    this.gallery.unfocus();
    this.rig.release({ duration: 1.4, fovKick: 5 });
    this.hud.setHidden(false);
    this.cursor.set('idle');
    this.dom.root.classList.remove('is-focus');
    this.sound.play('close');
    if (!pop) {
      // Unwind our own history entry so Back doesn't reopen the project.
      if (this._pushed) history.back();
      else history.replaceState({}, '', location.pathname + location.search);
    }
    setTimeout(() => {
      if (this.state !== 'closing') return;
      this.state = 'explore';
      this.input.locked = false;
    }, env.reducedMotion ? 300 : 700);
    // Return keyboard focus to the list entry for this work.
    if (env.keyboard) this.dom.hud.querySelectorAll('[data-hud-list] button')[card.index]?.focus({ preventScroll: true });
  }

  _openFromUrl() {
    const m = location.hash.match(/^#\/(.+)$/);
    if (!m) return;
    const card = this.gallery.cards.find((c) => slug(c.project.title) === m[1]);
    if (card) this.open(card, { push: false });
  }

  _onPop() {
    if (this.state === 'focus' && !location.hash) this.close({ pop: true });
    else if (this.state === 'explore') this._openFromUrl();
  }

  _setHover(card) {
    if (card === this.hovered) return;
    if (this.hovered) this.hovered.hoverTarget = 0;
    this.hovered = card;
    if (card) {
      card.hoverTarget = 1;
      this.sound.play('hover');
    }
    this.dom.root.classList.toggle('is-hovering', !!card);
  }

  // ---- Frame loop ---------------------------------------------------------

  _loop = (now) => {
    this._raf = requestAnimationFrame(this._loop);
    // Clamp dt so a stalled tab resumes gracefully instead of teleporting.
    const dt = Math.min(0.05, Math.max(0.0001, (now - this._last) / 1000));
    this._last = now;
    this.time += dt;
    this.update(dt);
  };

  update(dt) {
    const { rig, gallery, input } = this;
    rig.update(dt);
    this.stage.update(this.time);

    if (this.state === 'loading') {
      this.renderer.render(this.stage.scene, rig.camera);
      return;
    }

    gallery.update(dt, {
      camZ: rig.camera.position.z,
      camera: rig.camera,
      pointer: input.hasPointer ? input.pointer : this.noPointer,
      speed: rig.speed,
      reduced: env.reducedMotion,
      time: this.time,
    });

    // Hover picking (pointer devices only, never mid-drag or mid-flight).
    if (this.state === 'explore' && input.hasPointer && !input.dragging) {
      this.stage.scene.updateMatrixWorld();
      this._setHover(gallery.pick(input.pointer, rig.camera));
    } else if (this.state !== 'focus') {
      this._setHover(null);
    }

    if (this.state !== 'focus' && this.state !== 'closing') {
      if (input.dragging) this.cursor.set('drag', '');
      else if (this.hovered) this.cursor.set('view', 'View');
      else this.cursor.set('idle');

      const nearest = gallery.nearest(rig.camera.position.z);
      const roomChanged = this.hud.update({ card: nearest, progress: gallery.progress(rig.camera.position.z) });
      if (roomChanged) this.sound.play('room');
    }

    this.sound.setMotion(rig.speed);
    this.cursor.update(dt);
    this.renderer.render(this.stage.scene, rig.camera);
  }

  _onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.resize(w, h);
    this.rig.resize(w, h);
    this.gallery.setViewport(this.rig.aspect);
    if (this.focused) this.rig.focusOn(this.focused.framing, { duration: 0.35, fovKick: 0 });
  }

  dispose() {
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._onResize);
    window.removeEventListener('popstate', this._onPop);
    document.removeEventListener('visibilitychange', this._onVisibility);
    this.input.dispose();
    this.cursor.dispose();
    this.gallery.dispose();
    this.sound.dispose();
    this.renderer.dispose();
  }
}

async function loadFonts() {
  if (!document.fonts) return;
  const faces = [
    '400 84px "Instrument Serif"',
    'italic 400 84px "Instrument Serif"',
    '500 20px "JetBrains Mono"',
    '400 16px "Inter Tight"',
  ];
  const timeout = new Promise((r) => setTimeout(r, 3500));
  await Promise.race([Promise.all(faces.map((f) => document.fonts.load(f))).catch(() => {}), timeout]);
}
