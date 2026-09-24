import * as THREE from 'three';
import { clamp, damp, range, smoother } from '../utils/math.js';

/** Portion of the curve reachable by scrolling; the tail is only used as a look-ahead. */
const P_MAX = 0.965;

const PATH = [
  [0, 4, 36], [0, 3.4, 14], [0, 3, -10], [0, 3, -50], [0, 5, -80], [0, 7, -100], [0, 7, -121],
  [2, 9, -140], [3, 13, -165], [-2, 14, -190], [-3, 10, -215], [0, 7, -245], [0, 5, -275],
  [0, 4.5, -305], [0, 4.5, -332],
].map((v) => new THREE.Vector3(...v));

const UP = new THREE.Vector3(0, 1, 0);
const FORWARD_AXIS = new THREE.Vector3(0, 0, 1);

/**
 * Moves the camera along a spline driven by scroll progress (0..1),
 * layering gravity roll, inertial lean, mouse parallax and focus zoom.
 */
export class CameraRig {
  constructor({ reduced, mobile }) {
    this.reduced = reduced;
    this.mobile = mobile;
    this.camera = new THREE.PerspectiveCamera(52, 1, 0.1, 420);
    this.curve = new THREE.CatmullRomCurve3(PATH, false, 'centripetal');
    this.samples = this.curve.getSpacedPoints(800);

    this.baseFov = 52;
    this.parallax = new THREE.Vector2();
    this.lean = 0;
    this.focus = 0;
    this.roll = 0;

    this.flip = [this.scrollAtZ(-140), this.scrollAtZ(-166)];
    this.unflip = [this.scrollAtZ(-222), this.scrollAtZ(-252)];

    this._pos = new THREE.Vector3();
    this._ahead = new THREE.Vector3();
    this._off = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._qr = new THREE.Quaternion();
    this._qp = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  /** Scroll value (0..1) at which the camera first reaches world depth z. */
  scrollAtZ(z) {
    const s = this.samples;
    for (let i = 0; i < s.length; i++) if (s[i].z <= z) return clamp(i / (s.length - 1) / P_MAX);
    return 1;
  }

  rollAt(s) {
    if (this.reduced) return 0;
    return Math.PI * smoother(range(s, ...this.flip)) + Math.PI * smoother(range(s, ...this.unflip));
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.baseFov = aspect < 0.8 ? 68 : 52;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  update(s, dt, { mouse, velocity = 0, intro = 0, focus = 0 }) {
    const p = clamp(s) * P_MAX;
    this.curve.getPointAt(p, this._pos);
    this.curve.getPointAt(Math.min(p + 0.02, 1), this._ahead);

    // Intro: camera starts pulled back and high, then settles onto the path.
    this._pos.z += intro * 30;
    this._pos.y += intro * 9;
    this._ahead.y += intro * 3;

    const k = this.reduced ? 0 : 1;
    this.parallax.x = damp(this.parallax.x, mouse.x * k, 2.6, dt);
    this.parallax.y = damp(this.parallax.y, mouse.y * k, 2.6, dt);
    this.lean = damp(this.lean, clamp(velocity * 7, -1, 1) * k, 3, dt);
    this.focus = damp(this.focus, focus, 3.5, dt);
    this.roll = this.rollAt(s);

    this._m.lookAt(this._pos, this._ahead, UP);
    this._q.setFromRotationMatrix(this._m);
    this._qr.setFromAxisAngle(FORWARD_AXIS, this.roll - this.parallax.x * 0.015);
    this._q.multiply(this._qr);
    this._e.set(this.parallax.y * 0.05 - this.lean * 0.03, -this.parallax.x * 0.08, 0);
    this._qp.setFromEuler(this._e);
    this._q.multiply(this._qp);
    this.camera.quaternion.copy(this._q);

    this._off.set(this.parallax.x * 0.4, this.parallax.y * 0.25, 0).applyQuaternion(this._q);
    this.camera.position.copy(this._pos).add(this._off);

    const fov = this.baseFov + Math.abs(this.lean) * 5 - this.focus * 8;
    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
