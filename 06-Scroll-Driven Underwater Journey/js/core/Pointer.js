import * as THREE from 'three';
import { damp } from '../util.js';

export class Pointer {
  constructor() {
    this.x = 0; this.y = 0;        // raw NDC
    this.sx = 0; this.sy = 0;      // smoothed NDC
    this.px = innerWidth / 2; this.py = innerHeight / 2;
    this.active = false;
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.ndc = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 60;

    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onLeave = () => { this.active = false; };
    addEventListener('pointermove', this.onMove, { passive: true });
    addEventListener('pointerdown', this.onMove, { passive: true });
    addEventListener('pointerup', this.onUp, { passive: true });
    document.documentElement.addEventListener('pointerleave', this.onLeave);
  }

  onMove(e) {
    this.px = e.clientX; this.py = e.clientY;
    this.x = (e.clientX / innerWidth) * 2 - 1;
    this.y = -(e.clientY / innerHeight) * 2 + 1;
    this.active = true;
  }

  onUp(e) {
    if (e.pointerType === 'touch') { this.active = false; this.x = 0; this.y = 0; }
  }

  update(camera, dt) {
    this.sx = damp(this.sx, this.x, 5, dt);
    this.sy = damp(this.sy, this.y, 5, dt);
    this.ndc.set(this.x, this.y);
    this.raycaster.setFromCamera(this.ndc, camera);
  }

  get ray() { return this.raycaster.ray; }

  dispose() {
    removeEventListener('pointermove', this.onMove);
    removeEventListener('pointerdown', this.onMove);
    removeEventListener('pointerup', this.onUp);
    document.documentElement.removeEventListener('pointerleave', this.onLeave);
  }
}
