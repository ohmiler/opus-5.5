import * as THREE from 'three';
import { createGlowPointsMaterial } from './materials/GlowPointsMaterial.js';
import { ADDITIVE_FOG } from './shaders/chunks.js';
import { rng } from '../utils/math.js';

const HEAD = new THREE.Color(1.6, 1.8, 2.2);
const TAIL = new THREE.Color(2.4, 0.15, 0.25);

// Distant flying vehicles on fixed sky lanes: one instanced body mesh + one Points buffer for lights.
export class Traffic {
  constructor({ count }) {
    const rand = rng(21);
    this.lanes = [
      // along the avenue, above the rooftops of the frontage
      { axis: 'z', y: 34, offset: -3, dir: -1 },
      { axis: 'z', y: 38, offset: 3, dir: 1 },
      { axis: 'z', y: 58, offset: -8, dir: 1 },
      { axis: 'z', y: 62, offset: 8, dir: -1 },
      // crossing lanes, far down the street
      { axis: 'x', y: 44, offset: -64, dir: 1 },
      { axis: 'x', y: 48, offset: -70, dir: -1 },
      { axis: 'x', y: 96, offset: -150, dir: 1 },
      { axis: 'x', y: 104, offset: -190, dir: -1 },
    ];
    this.vehicles = Array.from({ length: count }, (_, i) => {
      const lane = this.lanes[i % this.lanes.length];
      return {
        lane,
        s: rand(),
        speed: (0.018 + rand() * 0.02) * (lane.axis === 'x' ? 1.2 : 1),
        wobble: rand() * 10,
      };
    });

    this.bodyGeo = new THREE.BoxGeometry(1.8, 0.55, 4.2);
    this.bodyMat = new THREE.MeshBasicMaterial({ color: 0x0c0d16 });
    this.bodies = new THREE.InstancedMesh(this.bodyGeo, this.bodyMat, count);
    this.bodies.frustumCulled = false;

    const lightCount = count * 3;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(lightCount * 3), 3));
    const colors = new Float32Array(lightCount * 3);
    const sizes = new Float32Array(lightCount);
    for (let i = 0; i < count; i++) {
      colors.set([HEAD.r, HEAD.g, HEAD.b], i * 9);
      colors.set([TAIL.r, TAIL.g, TAIL.b], i * 9 + 3);
      const under = i % 3 === 0 ? [0.1, 1.4, 1.8] : i % 3 === 1 ? [1.6, 0.2, 1.4] : [0.3, 0.3, 0.5];
      colors.set(under, i * 9 + 6);
      sizes.set([1.6, 1.3, 2.6], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    this.lightMat = createGlowPointsMaterial();
    this.lights = new THREE.Points(geo, this.lightMat);
    this.lights.frustumCulled = false;

    this.group = new THREE.Group();
    this.group.add(this.bodies, this.lights);
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
    this._e = new THREE.Euler();
  }

  setPointScale(s) {
    this.lightMat.uniforms.uScale.value = s;
  }

  update(dt, t, reducedMotion) {
    const pos = this.lights.geometry.attributes.position.array;
    const speedScale = reducedMotion ? 0.35 : 1;
    this.vehicles.forEach((v, i) => {
      v.s = (v.s + v.speed * dt * speedScale) % 1;
      const { lane } = v;
      const along = (v.s - 0.5) * 400 * lane.dir;
      const bob = Math.sin(t * 0.8 + v.wobble) * 0.4;
      let x, z, yaw;
      if (lane.axis === 'z') {
        x = lane.offset;
        z = along - 60;
        yaw = lane.dir > 0 ? Math.PI : 0;
      } else {
        x = along;
        z = lane.offset;
        yaw = (lane.dir > 0 ? -1 : 1) * (Math.PI / 2);
      }
      const y = lane.y + bob;
      this._e.set(0, yaw, Math.sin(t + v.wobble) * 0.05);
      this._q.setFromEuler(this._e);
      this._m.compose(this._p.set(x, y, z), this._q, this._s);
      this.bodies.setMatrixAt(i, this._m);

      // forward vector (local -Z) in world space
      const fx = -Math.sin(yaw);
      const fz = -Math.cos(yaw);
      pos[i * 9] = x + fx * 2.2;
      pos[i * 9 + 1] = y;
      pos[i * 9 + 2] = z + fz * 2.2;
      pos[i * 9 + 3] = x - fx * 2.2;
      pos[i * 9 + 4] = y;
      pos[i * 9 + 5] = z - fz * 2.2;
      pos[i * 9 + 6] = x;
      pos[i * 9 + 7] = y - 0.5;
      pos[i * 9 + 8] = z;
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.lights.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.bodyGeo.dispose();
    this.bodyMat.dispose();
    this.lights.geometry.dispose();
    this.lightMat.dispose();
  }
}

// Occasional low-flying patrol drone with blinking nav lights and a sweeping search cone.
export class Drones {
  constructor({ onPass }) {
    this.onPass = onPass;
    this.group = new THREE.Group();
    this.group.visible = false;
    this.timer = 6;
    this.active = null;

    this.bodyGeo = new THREE.BoxGeometry(1.2, 0.25, 1.2);
    this.armGeo = new THREE.BoxGeometry(2.4, 0.06, 0.1);
    this.mat = new THREE.MeshBasicMaterial({ color: 0x0d0e18 });
    const body = new THREE.Mesh(this.bodyGeo, this.mat);
    const a1 = new THREE.Mesh(this.armGeo, this.mat);
    const a2 = new THREE.Mesh(this.armGeo, this.mat);
    a1.rotation.y = Math.PI / 4;
    a2.rotation.y = -Math.PI / 4;
    this.drone = new THREE.Group();
    this.drone.add(body, a1, a2);

    // Search cone
    this.coneGeo = new THREE.ConeGeometry(3.2, 11, 32, 1, true).translate(0, -5.5, 0);
    this.coneMat = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uPower: { value: 1 } }]),
      vertexShader: /* glsl */ `
        varying float vH;
        varying vec3 vN;
        varying vec3 vV;
        #include <fog_pars_vertex>
        void main() {
          vH = -position.y / 11.0;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mvPosition.xyz);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uPower;
        varying float vH;
        varying vec3 vN;
        varying vec3 vV;
        #include <fog_pars_fragment>
        void main() {
          float edge = pow(1.0 - abs(dot(vN, vV)), 1.5);
          float a = (1.0 - vH) * 0.12 * (0.4 + edge) * uPower;
          gl_FragColor = vec4(vec3(0.75, 0.9, 1.0) * a, 1.0);
          ${ADDITIVE_FOG}
        }
      `,
    });
    this.cone = new THREE.Mesh(this.coneGeo, this.coneMat);
    this.drone.add(this.cone);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1.2, 0, 0, 1.2, 0, 0, 0, -0.2, 0]), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(9), 3));
    geo.setAttribute('size', new THREE.BufferAttribute(new Float32Array([0.8, 0.8, 1.4]), 1));
    this.lightMat = createGlowPointsMaterial();
    this.lights = new THREE.Points(geo, this.lightMat);
    this.lights.frustumCulled = false;
    this.drone.add(this.lights);

    this.group.add(this.drone);
  }

  setPointScale(s) {
    this.lightMat.uniforms.uScale.value = s;
  }

  #spawn(cameraZ) {
    // dir -1: overtakes the viewer from behind; dir 1: comes toward them.
    const dir = Math.random() < 0.5 ? -1 : 1;
    const from = dir < 0 ? cameraZ + 30 : cameraZ - 110;
    this.active = {
      from,
      to: from + dir * 140,
      x: (Math.random() - 0.5) * 8,
      y: 10 + Math.random() * 4,
      t: 0,
      duration: 14 + Math.random() * 6,
    };
    this.group.visible = true;
    this.onPass?.();
  }

  update(dt, t, camera, reducedMotion) {
    if (!this.active) {
      this.timer -= dt;
      if (this.timer <= 0) this.#spawn(camera.position.z);
      return;
    }
    const a = this.active;
    a.t += dt / a.duration;
    if (a.t >= 1) {
      this.active = null;
      this.group.visible = false;
      this.timer = 10 + Math.random() * 14;
      return;
    }
    const z = a.from + (a.to - a.from) * a.t;
    this.drone.position.set(a.x + Math.sin(t * 0.6) * 2, a.y + Math.sin(t * 1.3) * 0.3, z);
    this.drone.rotation.y = a.to > a.from ? Math.PI : 0;
    this.drone.rotation.z = Math.sin(t * 0.6) * 0.08;
    this.cone.rotation.x = reducedMotion ? 0.2 : Math.sin(t * 0.9) * 0.45;
    this.cone.rotation.z = reducedMotion ? 0 : Math.cos(t * 0.7) * 0.3;

    const c = this.lights.geometry.attributes.color.array;
    const blink = reducedMotion ? 1 : Math.sin(t * 6) > 0 ? 1 : 0.1;
    const strobe = reducedMotion ? 0.4 : Math.sin(t * 9) > 0.93 ? 3 : 0.2;
    c.set([2.4 * blink, 0.1, 0.1, 0.1, 2.2 * (1.1 - blink), 0.4, strobe, strobe, strobe]);
    this.lights.geometry.attributes.color.needsUpdate = true;
  }

  dispose() {
    this.bodyGeo.dispose();
    this.armGeo.dispose();
    this.mat.dispose();
    this.coneGeo.dispose();
    this.coneMat.dispose();
    this.lights.geometry.dispose();
    this.lightMat.dispose();
  }
}
