import * as THREE from 'three';
import { Spring, damp, smoothstep } from '../core/math.js';

const FRONT = new THREE.Vector3(0, 0, 1);

/**
 * Maps pointer behaviour onto the blob: follow, lean, proximity bulge,
 * press ripples. All responses run through springs for momentum.
 */
export class BlobInteraction {
  constructor({ camera, blob, pointer, bus, reduced = false }) {
    this.camera = camera;
    this.blob = blob;
    this.pointer = pointer;
    this.bus = bus;
    this.motion = reduced ? 0.35 : 1;

    this.followX = new Spring(0, { stiffness: 38, damping: 8 });
    this.followY = new Spring(0, { stiffness: 38, damping: 8 });
    this.strength = new Spring(0, { stiffness: 80, damping: 9 });
    this.energy = 0;
    this.hovering = false;
    this.spin = 0;

    this.raycaster = new THREE.Raycaster();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    this.hit = new THREE.Vector3();
    this.dirWorld = new THREE.Vector3(0, 0, 1);
    this.targetDir = new THREE.Vector3(0, 0, 1);
    this.localDir = new THREE.Vector3(0, 0, 1);
    this._tmp = new THREE.Vector3();
  }

  toLocal(dirWorld, out) {
    const mesh = this.blob.mesh;
    mesh.updateMatrixWorld();
    out.copy(mesh.position).addScaledVector(dirWorld, mesh.scale.x);
    return mesh.worldToLocal(out).normalize();
  }

  update(dt, { center, scale }) {
    const { pointer, blob } = this;
    const mesh = blob.mesh;

    // Follow: the blob drifts toward the pointer, lagging like a suspended mass.
    this.followX.target = pointer.active ? pointer.ndc.x * 0.22 * this.motion : 0;
    this.followY.target = pointer.active ? pointer.ndc.y * 0.14 * this.motion : 0;
    this.followX.update(dt);
    this.followY.update(dt);

    this.spin += dt * 0.07 * this.motion;
    mesh.position.set(center.x + this.followX.value, center.y + this.followY.value, center.z);
    mesh.scale.setScalar(scale);
    // Lean into the direction of travel; momentum shows up as tilt.
    mesh.rotation.set(-this.followY.velocity * 0.35, this.spin, -this.followX.velocity * 0.35);

    // Proximity: project the pointer onto the blob's depth plane.
    let proximity = 0;
    if (pointer.active) {
      this.plane.constant = -mesh.position.z;
      this.raycaster.setFromCamera(pointer.ndc, this.camera);
      if (this.raycaster.ray.intersectPlane(this.plane, this.hit)) {
        const lx = (this.hit.x - mesh.position.x) / scale;
        const ly = (this.hit.y - mesh.position.y) / scale;
        const r = Math.hypot(lx, ly);
        proximity = 1 - smoothstep(0.7, 1.9, r);
        const k = Math.min(r, 1);
        const nx = r > 1e-4 ? (lx / r) * k : 0;
        const ny = r > 1e-4 ? (ly / r) * k : 0;
        this.targetDir.set(nx, ny, Math.sqrt(Math.max(0, 1 - k * k)) + 0.15).normalize();
      }
    }
    this.dirWorld.lerp(this.targetDir, 1 - Math.exp(-9 * dt)).normalize();
    this.toLocal(this.dirWorld, this.localDir);

    this.strength.target = proximity * (pointer.down ? 1.45 : 1) * this.motion;
    this.strength.update(dt);

    this.energy = damp(this.energy, Math.min(pointer.speed * 0.35, 1) * proximity, 3, dt);

    blob.uniforms.uMouseDir.value.copy(this.localDir);
    blob.uniforms.uMouseStrength.value = this.strength.value;

    const hovering = proximity > 0.45;
    if (hovering !== this.hovering) {
      this.hovering = hovering;
      this.bus.emit('hover', hovering);
    }
  }

  /** Press: dent inward (negative impulse) then ripple outward across the surface. */
  press() {
    const onBlob = this.hovering;
    const dir = onBlob ? this.localDir.clone() : this.toLocal(FRONT, new THREE.Vector3());
    const amplitude = (onBlob ? 0.075 : 0.035) * this.motion;
    this.blob.ripple(dir, amplitude);
    if (onBlob) this.strength.impulse(-4.5 * this.motion);
    this.bus.emit('ripple', { strength: amplitude / 0.075, onBlob });
  }

  /** Ripple from an arbitrary world direction (used by narrative beats). */
  rippleFrom(dirWorld, amplitude) {
    this.blob.ripple(this.toLocal(dirWorld, new THREE.Vector3()), amplitude * this.motion);
  }
}
