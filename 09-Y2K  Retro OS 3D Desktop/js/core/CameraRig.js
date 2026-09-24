import * as THREE from 'three';
import { damp, easeInOutCubic, clamp, motion } from '../utils/helpers.js';

const tmp = new THREE.Vector3();

/**
 * Cinematic camera: a slow intro sweep, damped pointer parallax,
 * gentle focus pulls toward opened objects and clamped wheel zoom.
 * Every movement is eased — nothing ever snaps.
 */
export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 400);
    this.offset = new THREE.Vector3(0, 11.2, 13.8); // from look target
    this.lookBase = new THREE.Vector3(0, 0.6, 0.2);
    this.look = this.lookBase.clone();
    this.pointer = new THREE.Vector2();
    this.smoothPointer = new THREE.Vector2();
    this.focusPoint = new THREE.Vector3();
    this.focus = 0;
    this.focusTarget = 0;
    this.zoom = 0;
    this.zoomTarget = 0;
    this.distScale = 1;
    this.introT = 1;
    this.started = false;
    this.pos = new THREE.Vector3();
  }

  resize(w, h) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Keep the whole desk in frame on narrow / portrait screens.
    this.distScale = aspect >= 1.5 ? 1 : aspect >= 1 ? 1 + (1.5 - aspect) * 0.5 : 1.25 + (1 - aspect) * 1.25;
    this.camera.updateProjectionMatrix();
  }

  playIntro() {
    this.started = true;
    this.introT = motion.reduced ? 1 : 0;
  }

  setPointer(nx, ny) {
    this.pointer.set(nx, ny);
  }

  nudgeZoom(delta) {
    this.zoomTarget = clamp(this.zoomTarget + delta, -0.22, 0.28);
  }

  focusOn(worldPos, hold = 1100) {
    this.focusPoint.copy(worldPos);
    this.focusTarget = 1;
    clearTimeout(this._focusTimer);
    this._focusTimer = setTimeout(() => (this.focusTarget = 0), hold);
  }

  update(dt) {
    const reduced = motion.reduced;
    if (this.introT < 1) this.introT = Math.min(1, this.introT + dt / 3.6);
    const e = easeInOutCubic(this.introT);

    const px = reduced ? 0 : this.pointer.x;
    const py = reduced ? 0 : this.pointer.y;
    this.smoothPointer.x = damp(this.smoothPointer.x, px, 2.6, dt);
    this.smoothPointer.y = damp(this.smoothPointer.y, py, 2.6, dt);
    this.focus = damp(this.focus, this.focusTarget, 3.2, dt);
    this.zoom = damp(this.zoom, this.zoomTarget, 5, dt);

    const dist = this.distScale * (1 + this.zoom) * (1 - 0.1 * this.focus);
    tmp.copy(this.offset).multiplyScalar(dist);

    // Intro: orbit in from high above with a slow sweep.
    const sweep = (1 - e) * 0.9;
    const lift = 1 + (1 - e) * 1.6;
    const cos = Math.cos(sweep), sin = Math.sin(sweep);
    const x = tmp.x * cos - tmp.z * sin;
    const z = tmp.x * sin + tmp.z * cos;
    tmp.set(x, tmp.y * lift, z * (1 + (1 - e) * 0.4));

    tmp.x += this.smoothPointer.x * 1.4;
    tmp.y += -this.smoothPointer.y * 0.7;

    this.look.copy(this.lookBase).lerp(this.focusPoint, this.focus * 0.28);
    this.pos.copy(this.look).add(tmp);
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
    this.camera.rotateZ(-this.smoothPointer.x * 0.018);
  }
}
