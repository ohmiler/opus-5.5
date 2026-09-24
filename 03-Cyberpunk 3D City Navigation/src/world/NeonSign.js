import * as THREE from 'three';
import { LAYERS } from '../config.js';
import { Flicker } from '../utils/Flicker.js';
import { damp } from '../utils/math.js';
import { canvasTexture, createCanvas } from '../utils/canvas.js';

// A canvas-drawn neon panel with power (0..1), flicker personality and ignition.
// `draw(ctx, w, h)` paints the tubes; the mesh multiplies them by intensity so bloom picks them up.
export class NeonSign {
  constructor({ width, height, canvasSize = [256, 512], draw, flicker = 'steady', backing = true, boost = 1.9, power = 0.6 }) {
    const [cw, ch] = canvasSize;
    const { canvas, ctx } = createCanvas(cw, ch);
    draw(ctx, cw, ch);
    this.texture = canvasTexture(canvas);
    this.boost = boost;
    this.power = power;
    this.targetPower = power;
    this.flicker = new Flicker(flicker, Math.random());
    this.intensity = 0;

    this.group = new THREE.Group();

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
    this.plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), this.material);
    this.plane.layers.enable(LAYERS.REFLECT);
    this.group.add(this.plane);

    if (backing) {
      this.backingMaterial = new THREE.MeshBasicMaterial({ color: 0x06070c });
      const back = new THREE.Mesh(new THREE.BoxGeometry(width * 1.04, height * 1.02, 0.18), this.backingMaterial);
      back.position.z = -0.12;
      back.layers.enable(LAYERS.REFLECT);
      this.group.add(back);
      this.back = back;
    }
  }

  setPower(p, ignite = false) {
    if (ignite && p > this.targetPower + 0.15) this.flicker.ignite();
    this.targetPower = p;
  }

  update(dt, t, reducedMotion) {
    this.power = damp(this.power, this.targetPower, 6, dt);
    const f = this.flicker.update(dt, t, reducedMotion);
    this.intensity = this.power * f;
    this.material.color.setScalar(this.intensity * this.boost);
  }

  dispose() {
    this.texture.dispose();
    this.material.dispose();
    this.plane.geometry.dispose();
    this.backingMaterial?.dispose();
    this.back?.geometry.dispose();
  }
}
