import * as THREE from 'three';
import { LAYERS } from '../config.js';

// Raycasts against cheap invisible proxies on a dedicated layer.
export class Picker {
  constructor(objects) {
    this.objects = objects;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(LAYERS.PICK);
    this.ndc = new THREE.Vector2();
  }

  pick(x, y, camera) {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, camera);
    const hit = this.raycaster.intersectObjects(this.objects, false)[0];
    return hit?.object.userData.landmark ?? null;
  }
}
