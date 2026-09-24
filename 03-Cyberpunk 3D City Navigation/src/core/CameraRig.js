import * as THREE from 'three';
import { clamp, damp, easeInOutCubic, easeInOutQuart } from '../utils/math.js';

const UP = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler(0, 0, 0, 'YXZ');
const _v = new THREE.Vector3();
const _look = new THREE.Vector3();

// Cinematic camera: a damped walk along a spline (scroll), inertial mouse parallax,
// composition bias toward nearby landmarks, and arced flights into / out of focus poses.
export class CameraRig {
  constructor({ landmarks, reducedMotion, mobile }) {
    this.reducedMotion = reducedMotion;
    this.mobile = mobile;
    this.baseFov = 50;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 900);
    this.landmarks = landmarks;

    // Path sways away from each upcoming landmark so it is framed with perspective.
    this.path = new THREE.CatmullRomCurve3(
      [
        [0, 3.1, 36],
        [0.3, 3.0, 22],
        [1.3, 3.1, 6],
        [0.2, 3.2, -12],
        [-1.4, 3.0, -30],
        [-0.4, 3.2, -48],
        [1.2, 3.1, -66],
        [0.4, 3.2, -84],
        [0, 3.4, -104],
      ].map((p) => new THREE.Vector3(...p)),
      false,
      'centripetal',
    );
    this.length = this.path.getLength();

    this.progress = 0;
    this.target = 0;
    this.speed = 0;
    this.walkPhase = 0;
    this.mode = 'idle'; // idle | path | flight | focus
    this.parallax = new THREE.Vector2();
    this.parallaxWeight = 0; // eased back in after flights so parallax never pops
    this.look = new THREE.Vector3(0, 4, 0);
    this.fov = this.baseFov;
    this.flight = null;
    this.focusQuat = new THREE.Quaternion();
    this.focusPos = new THREE.Vector3();

    // Where along the path each section is best seen.
    this.stops = landmarks.map((l) => {
      const { side, z } = l.section.anchor;
      return { landmark: l, u: side === 0 ? 1 : this.#uForZ(z + 17) };
    });

    this.#pathPose(0, this.camera.position, this.look);
    this.camera.lookAt(this.look);
  }

  #uForZ(z) {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i <= 400; i++) {
      const u = i / 400;
      const d = Math.abs(this.path.getPointAt(u, _v).z - z);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  // Position + composed look target for a path parameter.
  #pathPose(u, outPos, outLook) {
    this.path.getPointAt(u, outPos);
    const tan = this.path.getTangentAt(Math.min(u, 0.999), _v);
    outLook.copy(outPos).addScaledVector(tan, 14);
    outLook.y = outPos.y + 1.4; // slight low-angle: towers loom

    // bias the gaze toward the nearest landmark sign
    for (const { landmark, u: su } of this.stops) {
      if (landmark.side === 0) continue;
      const d = (u - su) * this.length;
      const w = Math.exp(-((d / 13) ** 2)) * 0.32;
      if (w > 0.001) outLook.lerp(landmark.anchorPoint, w);
    }
  }

  get sectionIndexNear() {
    let idx = -1;
    let best = Infinity;
    this.stops.forEach((s, i) => {
      const d = Math.abs(this.progress - s.u) * this.length;
      if (d < best) {
        best = d;
        idx = i;
      }
    });
    return best < 13 ? idx : -1;
  }

  scroll(deltaU) {
    this.target = clamp(this.target + deltaU);
  }

  goTo(u) {
    this.target = clamp(u);
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    // portrait screens need a wider vertical field of view
    this.baseFov = aspect < 1 ? 64 : 50;
    this.camera.updateProjectionMatrix();
  }

  // Focus pose with composition offset: landmark on one third, panel on the other.
  focusPoseFor(landmark) {
    const { position, target } = landmark.focusPose;
    _m.lookAt(position, target, UP);
    const q = new THREE.Quaternion().setFromRotationMatrix(_m);
    const vfov = THREE.MathUtils.degToRad(this.baseFov);
    let yaw = 0;
    let pitch = 0;
    if (this.mobile || this.camera.aspect < 1) {
      pitch = -Math.atan(0.38 * Math.tan(vfov / 2)); // landmark in upper half, sheet below
    } else {
      const hfov = Math.atan(Math.tan(vfov / 2) * this.camera.aspect);
      yaw = (landmark.side > 0 ? 1 : -1) * Math.atan(0.34 * Math.tan(hfov));
    }
    q.multiply(_q.setFromEuler(_e.set(pitch, yaw, 0)));
    return { position: position.clone(), quaternion: q, panelSide: landmark.side > 0 ? 'left' : 'right' };
  }

  pathPoseAt(u) {
    const position = new THREE.Vector3();
    const look = new THREE.Vector3();
    this.#pathPose(u, position, look);
    _m.lookAt(position, look, UP);
    return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(_m), look };
  }

  // Arced flight between arbitrary poses. Resolves on arrival.
  fly(to, { duration, arc = 2, ctrl: ctrlOverride, onDone, next = 'focus' }) {
    const from = { position: this.camera.position.clone(), quaternion: this.camera.quaternion.clone() };
    const dist = from.position.distanceTo(to.position);
    const ctrl = from.position.clone().lerp(to.position, 0.5);
    ctrl.y += arc + dist * 0.14;
    if (ctrlOverride) ctrl.copy(ctrlOverride);
    const lateral = new THREE.Vector3().subVectors(to.position, from.position);
    const rollDir = Math.sign(lateral.x || 1);
    const dur = this.reducedMotion ? 0.001 : duration ?? THREE.MathUtils.clamp(1.3 + dist * 0.018, 1.4, 3.2);
    this.flight = { from, to, ctrl, t: 0, dur, rollDir, onDone, next };
    this.parallaxWeight = 0;
    this.mode = 'flight';
  }

  update(dt, t, pointer) {
    const cam = this.camera;
    const rm = this.reducedMotion;

    // inertial parallax (mouse / device)
    const px = rm ? 0 : pointer.x;
    const py = rm ? 0 : pointer.y;
    this.parallax.x = damp(this.parallax.x, px, 2.6, dt);
    this.parallax.y = damp(this.parallax.y, py, 2.6, dt);
    if (this.mode !== 'flight') this.parallaxWeight = damp(this.parallaxWeight, 1, 1.5, dt);
    const pw = this.parallaxWeight;

    if (this.mode === 'flight') {
      const f = this.flight;
      f.t = Math.min(1, f.t + dt / f.dur);
      const e = easeInOutQuart(f.t);
      const a = 1 - e;
      // quadratic bezier position
      cam.position.set(0, 0, 0)
        .addScaledVector(f.from.position, a * a)
        .addScaledVector(f.ctrl, 2 * a * e)
        .addScaledVector(f.to.position, e * e);
      // orientation leads position a touch — feels like the eye picks the target first
      const eo = easeInOutCubic(clamp(f.t * 1.18));
      cam.quaternion.slerpQuaternions(f.from.quaternion, f.to.quaternion, eo);
      cam.quaternion.multiply(_q.setFromEuler(_e.set(0, 0, Math.sin(Math.PI * e) * 0.07 * f.rollDir)));
      const fovKick = Math.sin(Math.PI * e) * 7;
      this.fov = this.baseFov + fovKick;
      if (f.t >= 1) {
        this.mode = f.next;
        if (f.next === 'focus') {
          this.focusPos.copy(f.to.position);
          this.focusQuat.copy(f.to.quaternion);
        }
        if (f.next === 'path') this.look.copy(f.to.look);
        this.flight = null;
        f.onDone?.();
      }
    } else if (this.mode === 'focus') {
      cam.position.copy(this.focusPos);
      cam.position.y += rm ? 0 : Math.sin(t * 0.6) * 0.05 * pw;
      cam.quaternion.copy(this.focusQuat);
      cam.quaternion.multiply(_q.setFromEuler(_e.set(this.parallax.y * 0.03 * pw, -this.parallax.x * 0.04 * pw, 0)));
      this.fov = damp(this.fov, this.baseFov, 3, dt);
    } else if (this.mode === 'path') {
      const prev = this.progress;
      this.progress = damp(this.progress, this.target, rm ? 5 : 2.4, dt);
      if (Math.abs(this.progress - this.target) < 1e-5) this.progress = this.target;
      this.speed = dt > 0 ? ((this.progress - prev) * this.length) / dt : 0;

      const lookTarget = _look; // must not alias _v (used for the tangent inside #pathPose)
      this.#pathPose(this.progress, cam.position, lookTarget);
      this.look.x = damp(this.look.x, lookTarget.x, 5, dt);
      this.look.y = damp(this.look.y, lookTarget.y, 5, dt);
      this.look.z = damp(this.look.z, lookTarget.z, 5, dt);

      // walking cadence proportional to speed
      const s = Math.min(Math.abs(this.speed) / 6, 1);
      if (!rm) {
        this.walkPhase += dt * (4 + s * 5) * s;
        cam.position.y += Math.sin(this.walkPhase * 2) * 0.05 * s + Math.sin(t * 0.7) * 0.02 * pw;
        cam.position.x += Math.cos(this.walkPhase) * 0.03 * s;
      }
      _m.lookAt(cam.position, this.look, UP);
      cam.quaternion.setFromRotationMatrix(_m);
      cam.quaternion.multiply(_q.setFromEuler(_e.set(this.parallax.y * 0.07 * pw, -this.parallax.x * 0.13 * pw, -this.parallax.x * 0.012 * pw)));
      this.fov = damp(this.fov, this.baseFov + (rm ? 0 : s * 4), 3, dt);
    }

    if (Math.abs(cam.fov - this.fov) > 0.01) {
      cam.fov = this.fov;
      cam.updateProjectionMatrix();
    }
  }
}
