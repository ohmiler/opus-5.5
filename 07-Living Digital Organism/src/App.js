import * as THREE from 'three';
import { Renderer } from './core/Renderer.js';
import { CameraRig } from './core/CameraRig.js';
import { Organism } from './organism/Organism.js';
import { Pointer } from './interaction/Pointer.js';
import { Cursor } from './interaction/Cursor.js';
import { ScrollNarrative } from './interaction/ScrollNarrative.js';
import { Loader } from './ui/Loader.js';
import { Hud } from './ui/Hud.js';
import { AudioBridge } from './audio/AudioBridge.js';
import { EventBus } from './utils/EventBus.js';
import { rng } from './utils/math.js';

const QUALITY = {
  high: { bodyDetail: 72, filaments: 110, segments: 56, spores: 3200, maxDpr: 2 },
  low: { bodyDetail: 36, filaments: 55, segments: 36, spores: 1200, maxDpr: 1.5 },
};

export class App {
  constructor(canvas) {
    this.canvas = canvas;
    this.bus = new EventBus();
    this.reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
    this.reduced = this.reducedMq.matches;
    this.mobile = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
    this.quality = this.mobile || navigator.hardwareConcurrency <= 4 ? QUALITY.low : QUALITY.high;
    // Seed from the URL (?seed=123) so a specimen can be shared; otherwise a new one each visit.
    const qs = new URLSearchParams(location.search).get('seed');
    this.seed = qs ? Number(qs) >>> 0 : (Math.random() * 2 ** 32) >>> 0;
    this.rand = rng(this.seed);
    this.running = false;
    this.clock = new THREE.Clock(false);
    this.center = new THREE.Vector3();
  }

  async init() {
    const loader = (this.loader = new Loader());
    await loader.step(0.08, 'preparing culture medium');
    await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);

    await loader.step(0.2, 'warming the incubator');
    this.renderer = new Renderer(this.canvas, { maxDpr: this.quality.maxDpr, antialias: !this.mobile });
    this.scene = new THREE.Scene();
    this.rig = new CameraRig({ rand: this.rand, reducedMotion: this.reduced });

    await loader.step(0.35, 'culturing membrane');
    this.organism = new Organism({ quality: this.quality, rand: this.rand, bus: this.bus, pixelRatio: this.renderer.pixelRatio });
    this.scene.add(this.organism.group);

    await loader.step(0.6, 'growing filaments · seeding spores');
    this.pointer = new Pointer({ bus: this.bus });
    this.cursor = new Cursor({ bus: this.bus });
    this.narrative = new ScrollNarrative({
      bus: this.bus,
      sections: document.querySelectorAll('.chapter'),
      progressList: document.getElementById('progress-list'),
      mobile: this.mobile,
    });
    this.hud = new Hud({ bus: this.bus });
    this.audio = new AudioBridge({ bus: this.bus, button: document.getElementById('sound-toggle') });
    document.getElementById('spec-verts').textContent = this.organism.body.vertexCount.toLocaleString('en');
    document.getElementById('spec-tent').textContent = String(this.organism.filaments.count);

    await loader.step(0.8, 'compiling nervous system');
    this.resize();
    this.renderer.compile(this.scene, this.rig.camera);
    this.renderer.render(this.scene, this.rig.camera);

    this.bindEvents();
    await loader.finish();

    // Reveal: dolly in from the dark while the organism grows from a point.
    document.body.classList.remove('is-loading');
    document.body.classList.add('is-ready');
    history.scrollRestoration = 'manual';
    scrollTo(0, 0);
    this.organism.beginLife();
    this.start();
    setTimeout(() => document.querySelector('.chapter--hero')?.classList.add('is-visible'), 700);
  }

  bindEvents() {
    this.onResize = () => this.resize();
    this.onVisibility = () => (document.hidden ? this.stop() : this.start());
    this.onReduced = (e) => { this.reduced = e.matches; this.rig.reduced = e.matches; };
    addEventListener('resize', this.onResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.reducedMq.addEventListener('change', this.onReduced);

    this.offs = [
      this.bus.on('tap', () => {
        // Provoking only makes sense when the touch lands on (or near) the creature.
        if (this.lastProbe && this.lastProbe.proximity > 0.2) {
          const k = this.organism.provoke(this.reduced ? 0.5 : 1);
          this.rig.jolt(0.35 * k);
          navigator.vibrate?.(Math.round(18 * k));
        }
      }),
    ];
    document.getElementById('again').addEventListener('click', () => {
      scrollTo({ top: 0, behavior: this.reduced ? 'auto' : 'smooth' });
    });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.resize(w, h);
    this.rig.resize(w, h);
    this.organism.setPixelRatio(this.renderer.pixelRatio);
  }

  start() {
    if (this.running || !this.organism?.born) return;
    this.running = true;
    this.clock.start();
    const frame = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(frame);
      this.tick(Math.min(this.clock.getDelta(), 1 / 20));
    };
    this.raf = requestAnimationFrame(frame);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.clock.stop();
  }

  tick(dt) {
    const timeScale = this.reduced ? 0.35 : 1;
    const pose = this.narrative.update(dt, this.reduced);
    const org = this.organism;

    org.group.position.set(pose.org[0], pose.org[1], pose.org[2]);
    org.group.scale.setScalar(pose.scale);

    this.rig.update(dt, {
      target: { x: pose.cam[0], y: pose.cam[1], z: pose.cam[2] },
      look: { x: pose.look[0], y: pose.look[1], z: pose.look[2] },
      pointer: this.pointer.ndc,
    });

    org.group.getWorldPosition(this.center);
    const probe = (this.lastProbe = this.pointer.probe(this.rig.camera, this.center, 1.3 * pose.scale));

    // Drag spins the organism with momentum; fast scrolling unsettles it a little.
    const drag = this.pointer.consumeDrag();
    if (drag) org.nudgeSpin(drag * 0.004);
    const idle = this.pointer.idleness();
    org.state.agitation += Math.min(Math.abs(this.narrative.velocity) * 0.02, 0.02);

    org.update(dt, { pointerWorld: probe.world, proximity: probe.proximity, idle, morph: pose, timeScale });

    const s = org.state;
    this.cursor.update(dt, {
      x: this.pointer.client.x, y: this.pointer.client.y,
      proximity: probe.proximity, defending: org.uniforms.uDefense.value > 0.25, habituated: s.habituation > 1.6,
    });
    this.hud.update(dt, { breathRate: s.breathRate, proximity: s.prox, agitation: s.agitation, idle, habituation: s.habituation });

    this.renderer.render(this.scene, this.rig.camera);
  }

  dispose() {
    this.stop();
    removeEventListener('resize', this.onResize);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.reducedMq.removeEventListener('change', this.onReduced);
    this.offs?.forEach((off) => off());
    [this.organism, this.pointer, this.cursor, this.narrative, this.hud, this.audio, this.renderer].forEach((c) => c?.dispose());
    this.bus.clear();
  }
}
