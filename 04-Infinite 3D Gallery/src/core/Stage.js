import * as THREE from 'three';

// The scene graph plus the atmosphere every material shares.
// Fog is computed in our own shaders (see Card / TextPlane) from these
// uniforms, so one object drives depth perception everywhere.
export class Stage {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);

    this.atmosphere = {
      uFogColor: { value: new THREE.Color(0x000000) },
      uFogNear: { value: 14 },
      uFogFar: { value: 58 },
      // Objects dissolve as they approach the lens instead of clipping.
      uNearFadeStart: { value: 0.6 },
      uNearFadeEnd: { value: 3.2 },
      uTime: { value: 0 },
    };
  }

  add(obj) {
    this.scene.add(obj);
  }

  update(time) {
    this.atmosphere.uTime.value = time;
  }
}

// Shared GLSL snippets for the custom atmosphere.
export const atmosphereGLSL = /* glsl */ `
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uNearFadeStart;
  uniform float uNearFadeEnd;
  float fogFactor(float depth) { return smoothstep(uFogNear, uFogFar, depth); }
  float nearFade(float depth) { return smoothstep(uNearFadeStart, uNearFadeEnd, depth); }
`;
