import * as THREE from 'three';
import { damp } from '../utils/math.js';
import { Noise1D } from '../utils/noise1d.js';

/**
 * Cinematic camera: follows narrative keyframes through damped springs,
 * adds pointer parallax and a faint "hand-held" breath. Never snaps.
 */
export class CameraRig {
  constructor({ rand, reducedMotion }) {
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
    this.camera.position.set(0, 0, 14); // starts far: the load reveal dollies in
    this.reduced = reducedMotion;
    this.pos = this.camera.position.clone();
    this.look = new THREE.Vector3();
    this.parallax = new THREE.Vector2();
    this.kick = 0;
    this.nx = new Noise1D(rand);
    this.ny = new Noise1D(rand);
    this.t = 0;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    // Keep the organism framed on portrait screens by widening the lens.
    this.camera.fov = w / h < 0.8 ? 50 : 35;
    this.camera.updateProjectionMatrix();
  }

  /** Small backward jolt, e.g. when the organism defends. */
  jolt(v) { if (!this.reduced) this.kick += v; }

  update(dt, { target, look, pointer }) {
    this.t += dt;
    const lam = this.reduced ? 6 : 1.6;
    this.pos.x = damp(this.pos.x, target.x, lam, dt);
    this.pos.y = damp(this.pos.y, target.y, lam, dt);
    this.pos.z = damp(this.pos.z, target.z, lam * 0.8, dt);
    this.look.x = damp(this.look.x, look.x, lam, dt);
    this.look.y = damp(this.look.y, look.y, lam, dt);
    this.look.z = damp(this.look.z, look.z, lam, dt);

    const pAmt = this.reduced ? 0 : 0.35;
    this.parallax.x = damp(this.parallax.x, pointer.x * pAmt, 2.2, dt);
    this.parallax.y = damp(this.parallax.y, pointer.y * pAmt, 2.2, dt);
    this.kick = damp(this.kick, 0, 3, dt);

    const hand = this.reduced ? 0 : 0.04;
    this.camera.position.set(
      this.pos.x + this.parallax.x + this.nx.at(this.t * 0.15) * hand,
      this.pos.y + this.parallax.y + this.ny.at(this.t * 0.13) * hand,
      this.pos.z + this.kick,
    );
    this.camera.lookAt(this.look);
  }
}
