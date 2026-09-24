import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { World } from './world/World.js';
import { Input } from './interaction/Input.js';
import { ScrollController } from './interaction/ScrollController.js';
import { Picker } from './interaction/Picker.js';
import { SoundBus } from './audio/SoundBus.js';
import { Loader } from './ui/Loader.js';
import { Cursor } from './ui/Cursor.js';
import { HoverCard } from './ui/HoverCard.js';
import { Panel } from './ui/Panel.js';
import { Hud } from './ui/Hud.js';
import { projects } from './data/projects.js';
import { damp } from './utils/math.js';

const $ = (s) => document.querySelector(s);

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2')) || !!c.getContext('webgl');
  } catch {
    return false;
  }
}

function showFallback() {
  const list = $('#fallback-list');
  list.replaceChildren(...projects.map((p) => {
    const li = document.createElement('li');
    const strong = document.createElement('strong');
    strong.textContent = p.title;
    li.append(strong, `${p.discipline} · ${p.location} · ${p.year}. ${p.lede}`);
    return li;
  }));
  $('#fallback').hidden = false;
}

class App {
  constructor() {
    this.mqReduced = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.mqReduced.matches;
    this.mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
    this.intro = 1;
    this.time = 0;
    this.hovered = null;
    this.running = false;
  }

  async init() {
    const loader = (this.loader = new Loader($('#loader')));
    if (!hasWebGL()) {
      loader.fail('WebGL is unavailable — showing the plain archive.');
      setTimeout(() => { $('#loader').remove(); showFallback(); }, 1200);
      return;
    }

    this.sound = new SoundBus();
    this.renderer = new Renderer($('#gl'), { mobile: this.mobile });
    this.scene = new THREE.Scene();
    this.rig = new CameraRig({ reduced: this.reduced, mobile: this.mobile });
    this.world = new World(this.scene, this.rig, { mobile: this.mobile, reduced: this.reduced });
    this.scroll = new ScrollController({ reduced: this.reduced });

    await loader.step(0.16, 'Setting type', () => Promise.race([
      Promise.all([
        document.fonts.load('400 100px "Instrument Serif"'),
        document.fonts.load('italic 400 100px "Instrument Serif"'),
        document.fonts.load('500 20px "JetBrains Mono"'),
      ]),
      new Promise((r) => setTimeout(r, 3000)), // never block on a slow font CDN
    ]).catch(() => {}));
    await loader.step(0.38, 'Pouring concrete', () => { this.world.buildMaterials(); this.world.buildEnvironment(); });
    await loader.step(0.64, 'Raising impossible structures', () => this.world.buildArchitecture());
    await loader.step(0.86, 'Hanging the exhibition', () => this.world.buildInstallations(projects));
    this.resize();
    await loader.step(1, 'Calibrating the sun', () => {
      this.rig.update(0, 1 / 60, { mouse: { x: 0, y: 0 }, intro: 1 });
      this.world.update(0, 0, 1 / 60);
      this.renderer.gl.compile(this.scene, this.rig.camera);
      this.renderer.render(this.scene, this.rig.camera);
    });

    this.setupInteraction();
    this.running = true;
    this.clock = new THREE.Clock();
    this.renderer.gl.setAnimationLoop(this.tick);
    await loader.finish();
    this.hud.reveal();
    this.introStarted = true;
  }

  setupInteraction() {
    this.picker = new Picker(this.rig.camera, this.world);
    this.hoverCard = new HoverCard($('#hover-card'));
    this.cursor = new Cursor($('#cursor'), this.hoverCard);
    this.panel = new Panel($('#panel'), {
      onClose: () => {
        this.scroll.locked = false;
        this.sound.emit('close');
      },
    });

    const sections = [
      ['Threshold', 40], ['Corridor of Recurrence', -8], ['The Rotating Room', -97],
      ['Inversion', -128], ['Floating Rooms', -205], ['The Horizon', -298],
    ].map(([name, z]) => ({ name, at: z > 30 ? 0 : this.rig.scrollAtZ(z) }));

    this.hud = new Hud($('#hud'), sections, {
      onNavigate: (at) => {
        if (this.panel.isOpen) this.panel.close();
        this.scroll.to(at);
      },
    });

    const soundBtn = $('#sound-toggle');
    soundBtn.addEventListener('click', () => {
      const on = this.sound.toggle();
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.querySelector('b').textContent = on ? 'On' : 'Off';
      this.sound.emit('toggle');
    });

    this.input = new Input($('#gl'), {
      onScroll: (d) => this.scroll.add(d),
      onMove: (m) => this.cursor.move(m.px, m.py),
      onPress: (down) => this.cursor.press(down),
      onTap: (t) => this.handleTap(t),
      onKey: (e) => this.handleKey(e),
    });

    this.mqReduced.addEventListener('change', (e) => {
      this.reduced = this.rig.reduced = this.world.reduced = e.matches;
      this.scroll.setReduced(e.matches);
    });

    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', () => this.clock?.getDelta());
    window.addEventListener('pagehide', () => this.dispose(), { once: true });
  }

  handleTap({ x, y, type }) {
    if (this.panel.isOpen) return;
    const inst = (type === 'mouse' && this.hovered) || this.picker.pick(x, y);
    if (inst) this.openProject(inst);
  }

  handleKey(e) {
    if (this.panel?.isOpen || e.target.closest?.('button, a')) return;
    const step = { ArrowDown: 0.03, ArrowRight: 0.03, PageDown: 0.08, ' ': 0.08, ArrowUp: -0.03, ArrowLeft: -0.03, PageUp: -0.08 }[e.key];
    if (step) { e.preventDefault(); this.scroll.to(this.scroll.target + step); }
    if (e.key === 'Home') this.scroll.to(0);
    if (e.key === 'End') this.scroll.to(1);
  }

  openProject(inst) {
    this.setHovered(null);
    this.scroll.locked = true;
    this.scroll.to(this.scroll.current); // settle where we are
    this.panel.open(inst.project, inst.coverDataURL());
    this.sound.emit('open', inst.project);
  }

  setHovered(inst) {
    if (inst === this.hovered) return;
    this.hovered?.setHover(false);
    this.hovered = inst;
    if (inst) {
      inst.setHover(true);
      this.hoverCard.show(inst.project);
      this.cursor.setState('view', 'View');
      this.sound.emit('hover', inst.project);
    } else {
      this.hoverCard.hide();
      if (this.cursor.state === 'view') this.cursor.setState('default');
    }
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.resize(w, h);
    this.rig.setAspect(w / h);
  }

  tick = () => {
    const dt = Math.min(this.clock.getDelta(), 1 / 20);
    this.time += dt;
    const { scroll, rig, input } = this;

    scroll.update(dt);
    if (this.introStarted) this.intro = this.reduced ? 0 : damp(this.intro, 0, 0.9, dt);

    rig.update(scroll.current, dt, {
      mouse: input.mouse.active ? input.mouse : { x: 0, y: 0 },
      velocity: scroll.velocity,
      intro: this.intro,
      focus: this.panel.isOpen ? 1 : 0,
    });
    this.world.update(scroll.current, this.time, dt);

    // Gravity cue fires whenever "down" passes through sideways.
    const inverted = Math.cos(rig.roll) < 0;
    if (inverted !== this.inverted && this.inverted !== undefined) this.sound.emit('gravity', { inverted });
    this.inverted = inverted;

    // Hover picking: only for a real mouse, when idle enough to aim.
    if (input.mouse.active && !this.panel.isOpen && Math.abs(scroll.velocity) < 0.08 && this.intro < 0.2) {
      this.setHovered(this.picker.pick(input.mouse.x, input.mouse.y));
    } else if (this.hovered) {
      this.setHovered(null);
    }

    if (this.hud.update(scroll.current, rig.camera, rig.roll)) this.sound.emit('section');
    this.renderer.exposure = damp(this.renderer.exposure, this.panel.isOpen ? 0.82 : 1.05, 3, dt);
    this.cursor.update(dt);
    this.renderer.render(this.scene, rig.camera);
  };

  dispose() {
    if (!this.running) return;
    this.running = false;
    this.renderer.gl.setAnimationLoop(null);
    this.input?.dispose();
    window.removeEventListener('resize', this.onResize);
    this.world.dispose();
    this.sound.dispose();
    this.renderer.dispose();
  }
}

new App().init().catch((err) => {
  console.error(err);
  const step = document.querySelector('#loader-step');
  if (step) step.textContent = 'Something collapsed while building. Please reload.';
});
