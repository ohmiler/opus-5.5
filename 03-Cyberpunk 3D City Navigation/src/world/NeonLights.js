import * as THREE from 'three';

const MAX = 8;

// A tiny fixed-size light table read by street & rain shaders — neon that "lights" wet surfaces
// without real-time lights.
export class NeonLights {
  constructor() {
    this.uniforms = {
      uNeonPos: { value: Array.from({ length: MAX }, () => new THREE.Vector3(0, -999, 0)) },
      uNeonColor: { value: Array.from({ length: MAX }, () => new THREE.Vector3()) },
    };
    this.lights = [];
  }

  add(position, color, strength = 1) {
    if (this.lights.length >= MAX) return null;
    const i = this.lights.length;
    const light = { i, color: new THREE.Color(color), strength, power: 1 };
    this.uniforms.uNeonPos.value[i].copy(position);
    this.lights.push(light);
    return light;
  }

  update() {
    for (const l of this.lights) {
      const k = l.power * l.strength;
      this.uniforms.uNeonColor.value[l.i].set(l.color.r * k, l.color.g * k, l.color.b * k);
    }
  }
}
