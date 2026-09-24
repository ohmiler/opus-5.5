import { clamp, damp, lerp, ss } from '../util.js';

/**
 * Maps scroll progress to a composed camera path:
 * looking up at the surface → level through the water column → tilting down onto the beacon.
 * Pointer adds a small, heavily damped look offset; scroll velocity adds a nose-dip for momentum.
 */
export class CameraRig {
  constructor(camera, { reduced }) {
    this.cam = camera;
    this.motion = reduced ? 0 : 1;
    this.look = reduced ? 0.3 : 1;
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.dip = 0;
    this.cam.rotation.order = 'YXZ';
  }

  update(p, vel, pointer, t, dt) {
    const m = this.motion;
    const end = ss(0.8, 1, p);

    const y = lerp(-1.5, -236, p) + Math.sin(t * 0.37) * 0.35 * m;
    const z = lerp(18, 8, end);
    const x = Math.sin(t * 0.11) * 1.5 * m;
    this.cam.position.set(x, y, z);

    const basePitch = lerp(0.42, 0, ss(0, 0.14, p)) - 0.06 * ss(0.14, 0.5, p) - 0.16 * end;

    this.yaw = damp(this.yaw, -pointer.x * 0.16 * this.look, 2.5, dt);
    this.pitch = damp(this.pitch, pointer.y * 0.09 * this.look, 2.5, dt);
    this.roll = damp(this.roll, -pointer.x * 0.025 * this.look, 2, dt);
    this.dip = damp(this.dip, clamp(-vel * 0.9, -0.08, 0.08) * m, 3, dt);

    this.cam.rotation.set(basePitch + this.pitch + this.dip, this.yaw, this.roll);
    this.cam.updateMatrixWorld();
  }
}
