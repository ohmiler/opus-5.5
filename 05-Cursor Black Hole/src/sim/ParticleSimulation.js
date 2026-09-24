import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { positionShader, velocityShader } from './shaders.js';
import { createInitialState } from './shapes.js';

function dataTexture(data, size) {
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
  tex.needsUpdate = true;
  return tex;
}

/** Owns the GPGPU state (position + velocity textures) and every physics uniform. */
export class ParticleSimulation {
  constructor(renderer, { size, rand, home, word, bigBang = true }) {
    this.size = size;
    this.count = size * size;

    this.randTexture = dataTexture(rand, size);
    this.homeTexture = dataTexture(home, size);
    this.wordTexture = dataTexture(word, size);

    // Full float where the GPU can render to it; half float keeps older mobile GPUs in the game.
    const ext = renderer.extensions;
    const type = ext.has('EXT_color_buffer_float')
      ? THREE.FloatType
      : ext.has('EXT_color_buffer_half_float')
        ? THREE.HalfFloatType
        : null;
    if (type === null) throw new Error('This GPU cannot render to float textures.');

    const gpu = new GPUComputationRenderer(size, size, renderer);
    gpu.setDataType(type);

    const initial = createInitialState(this.count, rand, home, { bigBang });
    const pos0 = gpu.createTexture();
    const vel0 = gpu.createTexture();
    pos0.image.data.set(initial.position);
    vel0.image.data.set(initial.velocity);

    this.positionVariable = gpu.addVariable('texturePosition', positionShader, pos0);
    this.velocityVariable = gpu.addVariable('textureVelocity', velocityShader, vel0);
    gpu.setVariableDependencies(this.positionVariable, [this.positionVariable, this.velocityVariable]);
    gpu.setVariableDependencies(this.velocityVariable, [this.positionVariable, this.velocityVariable]);

    this.positionUniforms = this.positionVariable.material.uniforms;
    this.positionUniforms.uDelta = { value: 0 };

    this.uniforms = this.velocityVariable.material.uniforms;
    Object.assign(this.uniforms, {
      uTime: { value: 0 },
      uDelta: { value: 0 },
      uPointer: { value: new THREE.Vector3() },
      uPointerGround: { value: new THREE.Vector3() },
      uPointerVel: { value: new THREE.Vector3() },
      uViewDir: { value: new THREE.Vector3(0, 0, -1) },
      uMass: { value: 0 },
      uReach: { value: 3 },
      uHorizon: { value: 0.3 },
      uBurst: { value: new THREE.Vector4() },
      uBurstShape: { value: new THREE.Vector2(1, 0) },
      uShapeA: { value: 0 },
      uShapeB: { value: 0 },
      uBlend: { value: 0 },
      uPinch: { value: 0 },
      uOffsetA: { value: new THREE.Vector3() },
      uOffsetB: { value: new THREE.Vector3() },
      uScale: { value: 1 },
      uStiffness: { value: 0 },
      uFlow: { value: 0 },
      uDamping: { value: 0.965 },
      uScrollVel: { value: 0 },
      tHome: { value: this.homeTexture },
      tRand: { value: this.randTexture },
      tWord: { value: this.wordTexture },
    });

    const error = gpu.init();
    if (error) {
      gpu.dispose();
      throw new Error(error);
    }
    this.gpu = gpu;
    this._burst = null;
  }

  get positionTexture() {
    return this.gpu.getCurrentRenderTarget(this.positionVariable).texture;
  }

  get velocityTexture() {
    return this.gpu.getCurrentRenderTarget(this.velocityVariable).texture;
  }

  /** Queue a detonation for the next step. If several land in one frame, the strongest wins. */
  burst(center, strength, radius, spin) {
    if (this._burst && this._burst.strength >= strength) return;
    this._burst = { x: center.x, y: center.y, z: center.z, strength, radius, spin };
  }

  setWord(data) {
    this.wordTexture.image.data.set(data);
    this.wordTexture.needsUpdate = true;
  }

  step(dt, p) {
    const u = this.uniforms;
    u.uTime.value = p.time;
    u.uDelta.value = dt;
    this.positionUniforms.uDelta.value = dt;

    u.uPointer.value.copy(p.pointer.world);
    u.uPointerGround.value.copy(p.pointer.ground);
    u.uPointerVel.value.copy(p.pointer.velocity);
    u.uViewDir.value.copy(p.viewDir);
    u.uMass.value = p.pointer.mass;
    u.uReach.value = p.pointer.reach;
    u.uHorizon.value = p.pointer.horizon;

    u.uShapeA.value = p.shapeA;
    u.uShapeB.value = p.shapeB;
    u.uBlend.value = p.blend;
    u.uPinch.value = p.pinch;
    u.uOffsetA.value.copy(p.offsetA);
    u.uOffsetB.value.copy(p.offsetB);
    u.uScale.value = p.scale;
    u.uStiffness.value = p.stiffness;
    u.uFlow.value = p.flow;
    u.uScrollVel.value = p.scrollVel;

    const b = this._burst;
    if (b) {
      u.uBurst.value.set(b.x, b.y, b.z, b.strength);
      u.uBurstShape.value.set(b.radius, b.spin);
      this._burst = null;
    } else {
      u.uBurst.value.w = 0;
    }

    this.gpu.compute();
  }

  dispose() {
    this.gpu.dispose();
    this.positionVariable.material.dispose();
    this.velocityVariable.material.dispose();
    this.randTexture.dispose();
    this.homeTexture.dispose();
    this.wordTexture.dispose();
  }
}
