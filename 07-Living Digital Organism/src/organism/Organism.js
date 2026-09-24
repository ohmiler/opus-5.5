import * as THREE from 'three';
import { Body } from './Body.js';
import { Filaments } from './Filaments.js';
import { Spores } from './Spores.js';
import { Spring } from '../utils/Spring.js';
import { Noise1D } from '../utils/noise1d.js';
import { clamp, damp } from '../utils/math.js';

const TAU = Math.PI * 2;

/**
 * The creature: geometry layers + a small behavioural model.
 * Nothing here is keyframed — every signal is integrated from noise and input,
 * so the organism never repeats itself.
 */
export class Organism {
  constructor({ quality, rand, bus, pixelRatio }) {
    this.bus = bus;
    this.group = new THREE.Group();
    this.inner = new THREE.Group(); // rotates; outer group is positioned by the narrative
    this.group.add(this.inner);

    this.uniforms = {
      uTime: { value: rand() * 1000 },
      uBreath: { value: 0 },
      uDefense: { value: 0 },
      uBirth: { value: 0 },
      uProx: { value: 0 },
      uPointer: { value: new THREE.Vector3(0, 0, 5) },
      uSeed: { value: new THREE.Vector3(rand() * 40, rand() * 40, rand() * 40) },
      uLobes: { value: 0.35 },
      uLobeFreq: { value: 1.2 },
      uCoral: { value: 0.05 },
      uReach: { value: 1 },
      uAccent: { value: new THREE.Color('#ff5b3a') },
    };

    // Independent noise channels — each behaviour has its own weather.
    this.n = {
      breath: new Noise1D(rand), hold: new Noise1D(rand),
      gx: new Noise1D(rand), gy: new Noise1D(rand), gz: new Noise1D(rand),
      wob: new Noise1D(rand), spin: new Noise1D(rand),
    };

    this.state = {
      clock: 0, breathPhase: rand() * TAU, breathRate: 0.2, agitation: 0,
      habituation: 0, shock: 0, evolved: 0, generation: 0, spinVel: 0, prox: 0,
    };
    this.defense = new Spring(0, { stiffness: 55, damping: 6.5 });
    this.birth = 0;
    this.born = false;
    this._inv = new THREE.Matrix4();
    this._p = new THREE.Vector3();

    this.body = new Body(this.uniforms, { detail: quality.bodyDetail });
    this.filaments = new Filaments(this.uniforms, { count: quality.filaments, segments: quality.segments, rand });
    this.spores = new Spores(this.uniforms, { count: quality.spores, rand, pixelRatio });
    this.inner.add(this.body.group, this.filaments.lines);
    this.group.add(this.spores.points); // spores don't spin with the body
  }

  get objects() { return [this.body.mesh, this.body.lattice, this.filaments.lines, this.spores.points]; }

  beginLife() { this.born = true; }

  provoke(strength = 1) {
    const s = this.state;
    const sensitivity = 1 / (1 + s.habituation * 0.9);
    const k = strength * sensitivity;
    this.defense.impulse(7.5 * k);
    s.shock = Math.min(1.4, s.shock + k);
    s.agitation = Math.min(1.5, s.agitation + 0.9 * k);
    s.habituation += 0.55;
    s.spinVel += (Math.random() - 0.5) * 1.6 * k;
    this.bus.emit('provoke', { strength: k, habituation: s.habituation });
    return k;
  }

  nudgeSpin(v) { this.state.spinVel += v; }

  /**
   * @param {object} i
   * @param {THREE.Vector3|null} i.pointerWorld closest point on the cursor ray, or null
   * @param {number} i.proximity 0..1
   * @param {number} i.idle 0..1 how idle the user is
   * @param {object} i.morph interpolated narrative form
   * @param {number} i.timeScale reduced-motion aware
   */
  update(dt, { pointerWorld, proximity, idle, morph, timeScale }) {
    const s = this.state;
    const u = this.uniforms;
    s.clock += dt;
    const c = s.clock;

    // Birth: slow organic swell (ease-out with a slight overshoot handled by the curve).
    if (this.born) this.birth = Math.min(1, this.birth + dt * 0.38);
    const b = this.birth;
    u.uBirth.value = b < 1 ? 1 - Math.pow(1 - b, 3) * Math.cos(b * 2.2) : 1;

    // Proximity & temperament.
    s.prox = damp(s.prox, proximity, 4, dt);
    s.agitation = damp(s.agitation, s.prox * 0.35, 0.45, dt);
    s.habituation = Math.max(0, s.habituation - dt * 0.07);
    s.shock = damp(s.shock, 0, 1.1, dt);
    u.uProx.value = s.prox;

    // Internal time runs faster when agitated.
    u.uTime.value += dt * timeScale * (0.75 + s.agitation * 1.4);

    // Breathing: rate wanders, sometimes holds, quickens under stress.
    const hold = this.n.hold.at(c * 0.07) < -0.55 ? 0.25 : 1;
    s.breathRate = (0.16 + this.n.breath.at(c * 0.05) * 0.05 + s.agitation * 0.32 + s.prox * 0.06) * hold;
    const prev = s.breathPhase;
    s.breathPhase += s.breathRate * TAU * dt * timeScale;
    // Asymmetric curve: quick inhale, long exhale.
    const ph = s.breathPhase;
    u.uBreath.value = Math.sin(ph + 0.45 * Math.sin(ph));
    if (Math.floor((prev - Math.PI / 2) / TAU) !== Math.floor((ph - Math.PI / 2) / TAU)) {
      this.bus.emit('breath', { rate: s.breathRate });
    }

    // Defense spring (underdamped → bristle, overshoot, settle).
    u.uDefense.value = this.defense.update(dt);
    this.spores.uniforms.uShock.value = s.shock;

    // Genome drift: always a little, a lot when nobody is watching.
    const speed = (0.01 + idle * 0.11) * timeScale;
    const gc = c * 0.03;
    u.uSeed.value.x += this.n.gx.at(gc) * speed * dt;
    u.uSeed.value.y += this.n.gy.at(gc + 11) * speed * dt;
    u.uSeed.value.z += this.n.gz.at(gc + 23) * speed * dt;
    s.evolved += idle * dt;
    const gen = Math.floor(s.evolved / 5);
    if (gen !== s.generation) { s.generation = gen; this.bus.emit('mutate', { generation: gen }); }

    // Form: narrative morph + idle mutation pushes toward stranger shapes.
    const mut = idle * 0.6;
    u.uLobes.value = morph.lobes + mut * 0.12 * this.n.wob.at(c * 0.02 + 5);
    u.uLobeFreq.value = morph.lobeFreq + mut * 0.6;
    u.uCoral.value = morph.coral + mut * 0.18;
    u.uReach.value = morph.reach * (1 + mut * 0.3);

    // Inertial rotation: base drift + momentum from drags and provocations.
    s.spinVel = damp(s.spinVel, 0, 1.2, dt);
    this.inner.rotation.y += (0.045 + this.n.spin.at(c * 0.04) * 0.03 + s.spinVel) * dt * timeScale;
    this.inner.rotation.x = this.n.wob.at(c * 0.03) * 0.35;
    this.inner.rotation.z = this.n.spin.at(c * 0.025 + 9) * 0.2;

    // Pointer into body space (the shaders work in the inner group's frame).
    if (pointerWorld) {
      this.inner.updateMatrixWorld();
      this._inv.copy(this.inner.matrixWorld).invert();
      this._p.copy(pointerWorld).applyMatrix4(this._inv);
      u.uPointer.value.lerp(this._p, 1 - Math.exp(-8 * dt));
    }
  }

  setPixelRatio(pr) { this.spores.setPixelRatio(pr); }

  dispose() {
    this.body.dispose();
    this.filaments.dispose();
    this.spores.dispose();
    this.group.removeFromParent();
  }
}
