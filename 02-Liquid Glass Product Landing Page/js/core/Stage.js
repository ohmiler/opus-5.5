import * as THREE from 'three';

/**
 * Owns renderer, scene, camera and the frame loop.
 * Components are plain objects with optional { object, update, resize, dispose }.
 */
export class Stage {
  constructor(canvas, { maxDpr = 2 } = {}) {
    this.maxDpr = maxDpr;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0xf3f2ee, 1);
    this.renderer.toneMapping = THREE.NoToneMapping;

    this.scene = new THREE.Scene();
    // Long lens: flatter perspective, more "product photography" than "3D demo".
    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    this.components = new Set();
    this.clock = new THREE.Clock(false);
    this.size = { width: 1, height: 1, aspect: 1, dpr: 1 };

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    this.resize();
  }

  add(component) {
    this.components.add(component);
    if (component.object) this.scene.add(component.object);
    component.resize?.(this.size);
    return component;
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.size = { width, height, aspect: width / height, dpr };

    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.components.forEach((c) => c.resize?.(this.size));
  }

  start(onFrame) {
    this.clock.start();
    this.renderer.setAnimationLoop(() => {
      // Clamp dt so a backgrounded tab doesn't explode the springs on return.
      const dt = Math.min(this.clock.getDelta(), 1 / 30);
      const t = this.clock.elapsedTime;
      onFrame?.(dt, t);
      this.components.forEach((c) => c.update?.(dt, t));
      this.renderer.render(this.scene, this.camera);
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this._onResize);
    this.components.forEach((c) => {
      if (c.object) this.scene.remove(c.object);
      c.dispose?.();
    });
    this.components.clear();
    this.scene.environment?.dispose();
    this.scene.environment = null;
    this.renderer.dispose();
  }
}
