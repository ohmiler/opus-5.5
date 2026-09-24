import * as THREE from 'three';

/** Raycasts installations, respecting architecture that stands in front of them. */
export class Picker {
  constructor(camera, world) {
    this.camera = camera;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.far = 55;
    this.ndc = new THREE.Vector2();
    this.targets = [...world.installations.map((i) => i.hit), ...world.occluders];
  }

  pick(x, y) {
    this.ndc.set(x, y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.targets, false)[0];
    return hit?.object.userData.installation || null;
  }
}
