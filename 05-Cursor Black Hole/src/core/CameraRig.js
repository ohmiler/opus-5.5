import * as THREE from 'three';
import { Spring, SpringVec3, clamp, lerp, smoothstep, easeInOutCubic } from '../utils/math.js';

/**
 * Cinematic camera: each chapter declares a pose, scroll blends between them,
 * and critically damped springs give the move weight. The pointer adds a little parallax.
 */
export class CameraRig {
  constructor(chapters, { reducedMotion = false } = {}) {
    this.chapters = chapters;
    this.reducedMotion = reducedMotion;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
    this.focus = new THREE.Vector3();

    const first = chapters[0].camera;
    // Opening shot: start deep in space and let the spring dolly us in.
    const start = reducedMotion ? first.position : [0, 0.4, 26];
    this._pos = new SpringVec3(start, 16, 8);
    this._look = new SpringVec3(first.look, 16, 8);
    this._roll = new Spring(first.roll, 16, 8);
    this._tp = [0, 0, 0];
    this._tl = [0, 0, 0];
    this._sync();
  }

  resize(aspect) {
    this.camera.aspect = aspect;
    // Portrait screens see less horizontally; widen the lens instead of cropping the forms.
    this.camera.fov = aspect < 1 ? Math.min(70, 45 + (1 - aspect) * 40) : 45;
    this.camera.updateProjectionMatrix();
  }

  update(dt, chapter, ndc, time) {
    const n = this.chapters.length;
    const a = clamp(Math.floor(chapter), 0, n - 1);
    const b = Math.min(a + 1, n - 1);
    const e = a === b ? 0 : easeInOutCubic(smoothstep(0.08, 0.92, chapter - a));
    const A = this.chapters[a].camera;
    const B = this.chapters[b].camera;

    for (let i = 0; i < 3; i++) {
      this._tp[i] = lerp(A.position[i], B.position[i], e);
      this._tl[i] = lerp(A.look[i], B.look[i], e);
    }
    let roll = lerp(A.roll, B.roll, e);

    if (!this.reducedMotion) {
      this._tp[0] += ndc.x * 0.5 + Math.sin(time * 0.11) * 0.16;
      this._tp[1] += ndc.y * 0.3 + Math.cos(time * 0.09) * 0.1;
      roll -= ndc.x * 0.015;
    }

    this._pos.setTarget(this._tp);
    this._look.setTarget(this._tl);
    this._roll.target = roll;
    this._pos.update(dt);
    this._look.update(dt);
    this._roll.update(dt);
    this._sync();
  }

  _sync() {
    this.camera.position.fromArray(this._pos.value);
    this.focus.fromArray(this._look.value);
    this.camera.lookAt(this.focus);
    this.camera.rotateZ(this._roll.value);
    this.camera.updateMatrixWorld();
  }
}
