import * as THREE from 'three';
import { clamp, damp, lerp, ease } from '../utils/math.js';
import { env } from '../utils/env.js';

// Camera physics.
//
// Two layers of motion are combined:
//  1. A *free* pose driven by inertial scroll (z), inertial pan (x/y) and
//     pointer parallax. Input writes to targets + velocities; the camera
//     chases them with critically-damped smoothing, so nothing is ever abrupt.
//  2. A *focus* pose (framing a single artwork). Transitions between the two
//     are timed tweens that snapshot the current pose, so any interruption
//     (card-to-card, close mid-flight) stays continuous.

const BASE_FOV = 42;

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(BASE_FOV, 1, 0.1, 140);
    this.aspect = 1;

    // Scroll along -z: position = scroll. Targets absorb input immediately,
    // velocity carries momentum after a flick or a drag release.
    this.scroll = 0;
    this.scrollTarget = 0;
    this.scrollVelocity = 0;
    this.speed = 0; // smoothed, units/sec — consumed by visual effects

    this.pan = new THREE.Vector2();
    this.panTarget = new THREE.Vector2();
    this.panVelocity = new THREE.Vector2();
    this.panLimit = new THREE.Vector2(3.2, 1.8);

    this.pointer = new THREE.Vector2(); // -1..1, damped
    this.pointerTarget = new THREE.Vector2();

    this.freePose = makePose();
    this.focusPose = null;
    this.current = makePose();
    this.fromPose = makePose();

    this.transition = null; // { t, duration, fovKick, easing }
    this.intro = null;
    this.time = 0;
  }

  get fovBase() {
    // Portrait screens get a slightly wider lens so compositions survive.
    return this.aspect < 0.8 ? BASE_FOV + 10 : BASE_FOV;
  }

  resize(width, height) {
    this.aspect = width / height;
    this.camera.aspect = this.aspect;
    this.panLimit.set(this.aspect < 0.8 ? 1.4 : 3.2, 1.8);
    this.camera.updateProjectionMatrix();
  }

  // ---- Input API ---------------------------------------------------------

  addScroll(delta) {
    this.scrollTarget += delta;
  }

  setScrollVelocity(v) {
    this.scrollVelocity = clamp(v, -80, 80);
  }

  addPan(dx, dy) {
    // Rubber-band resistance beyond the soft limits.
    const rx = Math.abs(this.panTarget.x) > this.panLimit.x ? 0.35 : 1;
    const ry = Math.abs(this.panTarget.y) > this.panLimit.y ? 0.35 : 1;
    this.panTarget.x += dx * rx;
    this.panTarget.y += dy * ry;
  }

  setPanVelocity(vx, vy) {
    this.panVelocity.set(clamp(vx, -25, 25), clamp(vy, -25, 25));
  }

  setPointer(nx, ny) {
    this.pointerTarget.set(nx, ny);
  }

  // ---- Choreography ------------------------------------------------------

  playIntro(from = 46, duration = 3.2) {
    this.intro = { from, t: 0, duration: env.reducedMotion ? 0.01 : duration };
    this.scroll = this.scrollTarget = from;
  }

  get introActive() {
    return !!this.intro;
  }

  // Frame a card so it covers the viewport ("object-fit: cover" in 3D).
  focusOn({ x, y, z, width, height }, { duration = 1.7, fovKick = 9 } = {}) {
    const fov = this.fovBase - 4;
    const tan = Math.tan(THREE.MathUtils.degToRad(fov / 2));
    const dH = height / 2 / tan;
    const dW = width / 2 / (tan * this.aspect);
    const dist = Math.min(dH, dW) * 0.985;
    this.focusPose = makePose(x, y, z + dist, 0, 0, 0, fov);
    this.focusTarget = { x, y, z, width, height };
    this._beginTransition(duration, fovKick);
    // Park the free camera in front of the artwork so "close" lands there.
    this.scrollTarget = this.scroll = z + 7.5;
    this.scrollVelocity = 0;
    this.panTarget.set(clamp(x * 0.55, -this.panLimit.x, this.panLimit.x), clamp(y * 0.4, -1, 1));
    this.pan.copy(this.panTarget);
    this.panVelocity.set(0, 0);
  }

  release({ duration = 1.3, fovKick = 4 } = {}) {
    this.focusPose = null;
    this.focusTarget = null;
    this._beginTransition(duration, fovKick);
  }

  get isFocused() {
    return !!this.focusPose;
  }

  get inTransition() {
    return !!this.transition;
  }

  _beginTransition(duration, fovKick) {
    copyPose(this.fromPose, this.current);
    const reduced = env.reducedMotion;
    this.transition = {
      t: 0,
      duration: reduced ? Math.min(duration, 0.45) : duration,
      fovKick: reduced ? 0 : fovKick,
    };
  }

  // ---- Simulation --------------------------------------------------------

  update(dt) {
    this.time += dt;
    const reduced = env.reducedMotion;

    // Intro: a long glide in from the dark.
    if (this.intro) {
      const it = this.intro;
      it.t = Math.min(1, it.t + dt / it.duration);
      this.scroll = this.scrollTarget = lerp(it.from, 0, ease.outExpo(it.t));
      if (it.t >= 1) this.intro = null;
    }

    // Momentum → target, then camera chases target.
    this.scrollTarget += this.scrollVelocity * dt;
    this.scrollVelocity *= Math.exp(-(reduced ? 8 : 2.6) * dt);
    const prev = this.scroll;
    this.scroll = damp(this.scroll, this.scrollTarget, reduced ? 14 : 5.2, dt);
    const instSpeed = (this.scroll - prev) / Math.max(dt, 1e-4);
    this.speed = damp(this.speed, instSpeed, 8, dt);

    this.panTarget.x += this.panVelocity.x * dt;
    this.panTarget.y += this.panVelocity.y * dt;
    this.panVelocity.multiplyScalar(Math.exp(-3.4 * dt));
    // Soft bounds: spring back when released beyond limits.
    const lx = this.panLimit.x;
    const ly = this.panLimit.y;
    if (Math.abs(this.panTarget.x) > lx) this.panTarget.x = damp(this.panTarget.x, Math.sign(this.panTarget.x) * lx, 4, dt);
    if (Math.abs(this.panTarget.y) > ly) this.panTarget.y = damp(this.panTarget.y, Math.sign(this.panTarget.y) * ly, 4, dt);
    const prevPanX = this.pan.x;
    this.pan.x = damp(this.pan.x, this.panTarget.x, 4.5, dt);
    this.pan.y = damp(this.pan.y, this.panTarget.y, 4.5, dt);
    const panSpeed = (this.pan.x - prevPanX) / Math.max(dt, 1e-4);

    const pl = reduced ? 0 : 1;
    this.pointer.x = damp(this.pointer.x, this.pointerTarget.x * pl, 3, dt);
    this.pointer.y = damp(this.pointer.y, this.pointerTarget.y * pl, 3, dt);

    // Free pose: parallax offset + a gaze toward the cursor + banking.
    const sway = reduced ? 0 : 1;
    const f = this.freePose;
    f.x = this.pan.x + this.pointer.x * 0.55 + Math.sin(this.time * 0.21) * 0.06 * sway;
    f.y = this.pan.y + this.pointer.y * 0.35 + Math.sin(this.time * 0.17 + 1) * 0.05 * sway;
    f.z = this.scroll;
    f.rx = this.pointer.y * 0.045 + clamp(this.speed * 0.0016, -0.03, 0.03) * sway;
    f.ry = -this.pointer.x * 0.07;
    f.rz = clamp(-panSpeed * 0.004, -0.05, 0.05) * sway;
    f.fov = this.fovBase + clamp(Math.abs(this.speed) * 0.08, 0, 6) * sway; // speed widens the lens

    // Focused pose breathes very slightly with the pointer so it never feels frozen.
    let target = f;
    if (this.focusPose) {
      target = this._focusLive || (this._focusLive = makePose());
      copyPose(target, this.focusPose);
      target.x += this.pointer.x * 0.04;
      target.y += this.pointer.y * 0.03;
      target.ry = -this.pointer.x * 0.008;
      target.rx = this.pointer.y * 0.006;
    }

    if (this.transition) {
      const tr = this.transition;
      tr.t = Math.min(1, tr.t + dt / tr.duration);
      const k = ease.cinematic(tr.t);
      lerpPose(this.current, this.fromPose, target, k);
      this.current.fov += Math.sin(Math.PI * tr.t) * tr.fovKick; // dolly-zoom kick
      if (tr.t >= 1) this.transition = null;
    } else {
      copyPose(this.current, target);
    }

    this._apply();
  }

  _apply() {
    const c = this.camera;
    const p = this.current;
    c.position.set(p.x, p.y, p.z);
    c.rotation.set(p.rx, p.ry, p.rz, 'YXZ');
    if (Math.abs(c.fov - p.fov) > 0.001) {
      c.fov = p.fov;
      c.updateProjectionMatrix();
    }
    c.updateMatrixWorld();
  }
}

function makePose(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, fov = BASE_FOV) {
  return { x, y, z, rx, ry, rz, fov };
}
function copyPose(o, a) {
  o.x = a.x; o.y = a.y; o.z = a.z; o.rx = a.rx; o.ry = a.ry; o.rz = a.rz; o.fov = a.fov;
  return o;
}
function lerpPose(o, a, b, t) {
  o.x = lerp(a.x, b.x, t); o.y = lerp(a.y, b.y, t); o.z = lerp(a.z, b.z, t);
  o.rx = lerp(a.rx, b.rx, t); o.ry = lerp(a.ry, b.ry, t); o.rz = lerp(a.rz, b.rz, t);
  o.fov = lerp(a.fov, b.fov, t);
  return o;
}
