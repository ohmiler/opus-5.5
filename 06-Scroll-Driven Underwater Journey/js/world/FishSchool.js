import * as THREE from 'three';
import { TAU, rng, ss } from '../util.js';

const VERT = /* glsl */ `
#include <fog_pars_vertex>
uniform float uTime;
attribute float aPhase;
varying vec3 vN;
varying float vSide;
void main() {
  vec3 p = position;
  float tail = smoothstep(0.2, -1.0, p.z);
  p.x += sin(uTime * 9.0 + aPhase * 6.2831 + p.z * 4.0) * 0.16 * tail;
  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vSide = position.y;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
#include <fog_pars_fragment>
uniform vec3 uColor;
uniform float uLight;
varying vec3 vN;
varying float vSide;
void main() {
  float top = smoothstep(-0.15, 0.2, vSide);
  vec3 col = mix(uColor * 1.35, uColor * 0.3, top);   // countershading
  float rim = pow(1.0 - abs(normalize(vN).z), 2.0);
  col += rim * 0.3 * uLight;
  col *= mix(0.2, 1.0, uLight);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}`;

let sharedGeo = null;
function fishGeometry() {
  if (sharedGeo) return sharedGeo;
  const g = new THREE.SphereGeometry(0.5, 12, 8);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i) * 0.32;
    let y = pos.getY(i) * 0.7;
    let z = pos.getZ(i) * 2;
    if (z < -0.2) {             // taper toward the tail and flare a fin
      const k = (-z - 0.2) / 0.8;
      x *= 1 - k * 0.8;
      y *= 1 - k * 0.5 + k * k * 1.6;
      z -= k * 0.25;
    }
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  sharedGeo = g;
  return g;
}

/**
 * A school orbiting a wandering centre. Each fish chases its lane target;
 * the pointer ray repels fish nearby, which then regroup with momentum.
 */
export class FishSchool {
  constructor(scene, { count, y, z = -14, size = 0.5, color = '#9cc3d6', radius = 14, speed = 0.3, seed = 1, onScatter }) {
    const r = rng(seed);
    this.count = count;
    this.center = new THREE.Vector3(0, y, z);
    this.home = this.center.clone();
    this.radius = radius;
    this.speed = speed * (r() > 0.5 ? 1 : -1);
    this.onScatter = onScatter;
    this.lastScatter = 0;

    const geo = fishGeometry().clone();
    const phases = new Float32Array(count);
    for (let i = 0; i < count; i++) phases[i] = r();
    geo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));

    this.mat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uLight: { value: 1 } },
      ]),
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);

    this.fish = [];
    const lead = r() * TAU;
    for (let i = 0; i < count; i++) {
      const f = {
        lane: radius * (0.55 + r() * 0.5),
        yOff: (r() - 0.5) * 4,
        phase: lead + (r() - 0.5) * 1.3,
        wob: r() * TAU,
        size: size * (0.7 + r() * 0.6),
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
      };
      this.target(f, 0, f.pos);
      this.fish.push(f);
    }
    this.dummy = new THREE.Object3D();
    this.tmp = new THREE.Vector3();
    this.tmp2 = new THREE.Vector3();
  }

  target(f, t, out) {
    const a = t * this.speed + f.phase;
    return out.set(
      this.center.x + Math.cos(a) * f.lane,
      this.center.y + f.yOff + Math.sin(t * 0.8 + f.wob) * 0.6,
      this.center.z + Math.sin(a) * f.lane * 0.55,
    );
  }

  update(t, dt, pointer, camera, p) {
    const near = Math.abs(camera.position.y - this.home.y) < 55;
    this.mesh.visible = near;
    if (!near) return;

    this.mat.uniforms.uTime.value = t;
    this.mat.uniforms.uLight.value = 1 - ss(0.1, 0.6, p) * 0.85;
    this.center.set(
      this.home.x + Math.sin(t * 0.07) * this.radius * 0.6,
      this.home.y + Math.sin(t * 0.19) * 2,
      this.home.z + Math.cos(t * 0.09) * 6,
    );

    const ray = pointer.ray;
    const fleeR = 5.5;
    let scattered = 0;
    for (let i = 0; i < this.count; i++) {
      const f = this.fish[i];
      this.target(f, t, this.tmp);
      const desired = this.tmp.sub(f.pos).multiplyScalar(1.6);

      if (pointer.active) {
        ray.closestPointToPoint(f.pos, this.tmp2);
        const d = f.pos.distanceTo(this.tmp2);
        if (d < fleeR) {
          const k = 1 - d / fleeR;
          this.tmp2.subVectors(f.pos, this.tmp2).normalize().multiplyScalar(70 * k * k * dt);
          f.vel.add(this.tmp2);
          scattered++;
        }
      }

      f.vel.lerp(desired, 1 - Math.exp(-1.6 * dt));
      const sp = f.vel.length();
      if (sp > 14) f.vel.multiplyScalar(14 / sp);
      f.pos.addScaledVector(f.vel, dt);

      const d = this.dummy;
      d.position.copy(f.pos);
      if (sp > 0.01) d.lookAt(this.tmp.copy(f.pos).add(f.vel));
      d.scale.setScalar(f.size);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    if (scattered > 3 && t - this.lastScatter > 0.9) {
      this.lastScatter = t;
      this.onScatter?.();
    }
  }
}
