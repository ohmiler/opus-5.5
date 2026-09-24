import * as THREE from 'three';
import { env } from '../utils/env.js';

// Owns the WebGL context, canvas sizing and pixel-ratio policy.
export class Renderer {
  constructor(container) {
    this.container = container;
    this.instance = new THREE.WebGLRenderer({
      antialias: env.pixelRatio < 1.5,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    this.instance.setClearColor(0x000000, 1);
    this.instance.outputColorSpace = THREE.SRGBColorSpace;
    this.instance.domElement.setAttribute('aria-hidden', 'true');
    this.instance.domElement.className = 'webgl';
    container.appendChild(this.instance.domElement);
    this.width = 1;
    this.height = 1;
  }

  get domElement() {
    return this.instance.domElement;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.instance.setPixelRatio(env.pixelRatio);
    this.instance.setSize(width, height, false);
  }

  render(scene, camera) {
    this.instance.render(scene, camera);
  }

  compile(scene, camera) {
    this.instance.compile(scene, camera);
  }

  dispose() {
    this.instance.dispose();
    this.instance.forceContextLoss();
    this.instance.domElement.remove();
  }
}
