import * as THREE from 'three';
import { ss } from '../util.js';

/**
 * Chapters fade in over depth ranges. They parallax against the pointer (opposite the camera look),
 * and anchored chapters track a projected 3D point so type sits inside the scene.
 */
export class Narrative {
  constructor(anchors = {}) {
    this.anchors = anchors;
    this.v3 = new THREE.Vector3();
    this.items = [...document.querySelectorAll('.chapter')].map((el) => {
      const [a, b] = el.dataset.range.split(',').map(Number);
      return { el, a, b, anchor: el.dataset.anchor, v: -1 };
    });
    this.root = document.documentElement;
  }

  update(p, pointer, camera) {
    this.root.style.setProperty('--px', (-pointer.sx).toFixed(3));
    this.root.style.setProperty('--py', pointer.sy.toFixed(3));

    for (const it of this.items) {
      const v = ss(it.a - 0.025, it.a + 0.015, p) * (1 - ss(it.b - 0.015, it.b + 0.025, p));
      if (Math.abs(v - it.v) > 0.002) {
        it.v = v;
        it.el.style.setProperty('--v', v.toFixed(3));
        it.el.classList.toggle('is-on', v > 0.001);
      }
      if (it.anchor && v > 0.001) {
        this.v3.copy(this.anchors[it.anchor]).project(camera);
        const x = (this.v3.x * 0.5 + 0.5) * innerWidth;
        const y = (-this.v3.y * 0.5 + 0.5) * innerHeight;
        it.el.style.left = `${x - it.el.offsetWidth / 2}px`;
        it.el.style.top = `${Math.max(70, y - it.el.offsetHeight)}px`;
      }
    }
  }
}
