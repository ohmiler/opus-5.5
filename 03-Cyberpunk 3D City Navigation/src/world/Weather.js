import * as THREE from 'three';
import { NOISE, NEON_LIGHTS, ADDITIVE_FOG } from './shaders/chunks.js';

// All three effects are fully GPU-animated: the CPU only updates a few uniforms per frame.

// ─── Rain: streaks in a camera-following wrapped volume, tinted by nearby neon ───
export class Rain {
  constructor({ count, neonLights, reducedMotion }) {
    const seeds = new Float32Array(count * 2 * 4);
    const ends = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const s = [Math.random(), Math.random(), Math.random(), Math.random()];
      seeds.set(s, i * 8);
      seeds.set(s, i * 8 + 4);
      ends[i * 2] = 0;
      ends[i * 2 + 1] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 2 * 3), 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    geo.setAttribute('end', new THREE.BufferAttribute(ends, 1));

    const uniforms = THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uVolume: { value: new THREE.Vector3(46, 26, 60) },
        uSpeed: { value: reducedMotion ? 7 : 22 },
        uLength: { value: reducedMotion ? 0.25 : 0.75 },
        uWind: { value: new THREE.Vector2(-0.18, 0.05) },
      },
    ]);
    uniforms.uNeonPos = neonLights.uniforms.uNeonPos;
    uniforms.uNeonColor = neonLights.uniforms.uNeonColor;

    this.material = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms,
      vertexShader: /* glsl */ `
        attribute vec4 seed;
        attribute float end;
        uniform float uTime, uSpeed, uLength;
        uniform vec3 uCam, uVolume;
        uniform vec2 uWind;
        varying float vAlpha;
        varying vec3 vTint;
        ${NEON_LIGHTS}
        #include <fog_pars_vertex>
        void main() {
          float speed = uSpeed * (0.8 + seed.w * 0.4);
          vec3 p;
          // Wrap around the camera so rain is infinite but bounded.
          p.x = uCam.x + (fract((seed.x * uVolume.x - uCam.x) / uVolume.x) - 0.5) * uVolume.x;
          p.z = uCam.z - 8.0 + (fract((seed.z * uVolume.z - uCam.z + 8.0) / uVolume.z) - 0.5) * uVolume.z;
          p.y = fract(seed.y - uTime * speed / uVolume.y) * uVolume.y;
          vec3 dir = normalize(vec3(uWind.x, -1.0, uWind.y));
          p -= dir * end * uLength * (0.7 + seed.w * 0.6);

          vec3 tint = vec3(0.5, 0.58, 0.75);
          for (int i = 0; i < NEON_COUNT; i++) {
            vec3 d = p - uNeonPos[i];
            tint += uNeonColor[i] * (3.0 / (1.0 + dot(d, d) * 0.03));
          }
          vTint = tint;

          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          float depth = -mvPosition.z;
          vAlpha = smoothstep(0.6, 3.0, depth) * (1.0 - end * 0.85) * (0.06 + seed.w * 0.08);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vTint;
        #include <fog_pars_fragment>
        void main() {
          gl_FragColor = vec4(vTint * vAlpha, 1.0);
          ${ADDITIVE_FOG}
        }
      `,
    });
    this.mesh = new THREE.LineSegments(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  setReducedMotion(r) {
    this.material.uniforms.uSpeed.value = r ? 7 : 22;
    this.material.uniforms.uLength.value = r ? 0.25 : 0.75;
  }

  update(dt, t, camera) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uCam.value.copy(camera.position);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}

// ─── Splashes: rings where drops hit the street; each instance re-spawns every cycle ───
export class Splashes {
  constructor({ count }) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const seeds = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) seeds.set([Math.random(), Math.random(), Math.random()], i * 3);
    geo.setAttribute('seed', new THREE.InstancedBufferAttribute(seeds, 3));
    geo.instanceCount = count;
    this.base = base;

    this.material = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uArea: { value: new THREE.Vector2(22, 34) } },
      ]),
      vertexShader: /* glsl */ `
        attribute vec3 seed;
        uniform float uTime;
        uniform vec3 uCam;
        uniform vec2 uArea;
        varying vec2 vUv;
        varying float vLife;
        ${NOISE}
        #include <fog_pars_vertex>
        void main() {
          float period = 0.5 + seed.z * 0.5;
          float cyc = uTime / period + seed.x * 10.0;
          float id = floor(cyc);
          vLife = fract(cyc);
          vec2 r = hash22(vec2(id, seed.y * 91.0)) - 0.5;
          vec3 center = vec3(uCam.x + r.x * uArea.x, 0.02, uCam.z - uArea.y * 0.45 + r.y * uArea.y);
          float size = 0.1 + vLife * (0.22 + seed.y * 0.18);
          vec3 p = center + position * size;
          vUv = uv;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec2 vUv;
        varying float vLife;
        #include <fog_pars_fragment>
        void main() {
          float d = length(vUv - 0.5) * 2.0;
          float ring = smoothstep(0.12, 0.0, abs(d - 0.8)) * (1.0 - vLife);
          float dot0 = smoothstep(0.3, 0.0, d) * smoothstep(0.25, 0.0, vLife) * 1.5;
          float a = (ring + dot0) * 0.12;
          if (a < 0.002) discard;
          gl_FragColor = vec4(vec3(0.62, 0.72, 0.95) * a, 1.0);
          ${ADDITIVE_FOG}
        }
      `,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
  }

  update(dt, t, camera) {
    this.material.uniforms.uTime.value = t;
    this.material.uniforms.uCam.value.copy(camera.position);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.base.dispose();
    this.material.dispose();
  }
}

// ─── Steam: soft particles rising from street vents, tinted by nearby neon ───
export class Steam {
  constructor({ vents, perVent, reducedMotion }) {
    const n = vents.length * perVent;
    const pos = new Float32Array(n * 3);
    const seed = new Float32Array(n * 2);
    const tint = new Float32Array(n * 3);
    const c = new THREE.Color();
    vents.forEach((v, vi) => {
      c.set(v.tint);
      for (let i = 0; i < perVent; i++) {
        const k = vi * perVent + i;
        pos.set([v.x, 0, v.z], k * 3);
        seed.set([Math.random(), Math.random()], k * 2);
        tint.set([c.r, c.g, c.b], k * 3);
      }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 2));
    geo.setAttribute('tint', new THREE.BufferAttribute(tint, 3));

    this.material = new THREE.ShaderMaterial({
      fog: true,
      transparent: true,
      depthWrite: false,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uScale: { value: 400 }, uRate: { value: reducedMotion ? 0.03 : 0.11 } },
      ]),
      vertexShader: /* glsl */ `
        attribute vec2 seed;
        attribute vec3 tint;
        uniform float uTime, uScale, uRate;
        varying float vAlpha;
        varying vec3 vTint;
        varying float vRot;
        #include <fog_pars_vertex>
        void main() {
          float life = fract(uTime * uRate * (0.8 + seed.y * 0.5) + seed.x);
          vec3 p = position;
          float a = seed.x * 6.2831;
          p.x += sin(a) * 0.4 + sin(life * 4.0 + seed.y * 10.0) * life * 1.2 - life * 1.5;
          p.z += cos(a) * 0.4 + cos(life * 3.0 + seed.x * 7.0) * life * 1.0;
          p.y += life * 7.0 + 0.2;
          vTint = tint;
          vRot = seed.y * 6.2831 + life * 1.5;
          vAlpha = smoothstep(0.0, 0.12, life) * (1.0 - life) * 0.16;
          vec4 mvPosition = viewMatrix * vec4(p, 1.0);
          gl_PointSize = (0.8 + life * 3.2) * uScale / max(-mvPosition.z, 0.1);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        varying float vAlpha;
        varying vec3 vTint;
        varying float vRot;
        #include <fog_pars_fragment>
        ${NOISE}
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv) * 2.0;
          float cs = cos(vRot), sn = sin(vRot);
          float n = vnoise(mat2(cs, -sn, sn, cs) * uv * 4.0 + vRot);
          float a = smoothstep(1.0, 0.1, d) * (0.5 + 0.7 * n) * vAlpha;
          if (a < 0.003) discard;
          gl_FragColor = vec4(vTint, a);
          #include <fog_fragment>
        }
      `,
    });
    this.mesh = new THREE.Points(geo, this.material);
    this.mesh.frustumCulled = false;

    // Vent grates with a faint sodium glow underneath
    this.grateMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff7a2a').multiplyScalar(0.5), toneMapped: false });
    this.grateGeo = new THREE.RingGeometry(0.5, 0.75, 24).rotateX(-Math.PI / 2);
    this.grates = new THREE.InstancedMesh(this.grateGeo, this.grateMat, vents.length);
    const m = new THREE.Matrix4();
    vents.forEach((v, i) => this.grates.setMatrixAt(i, m.makeTranslation(v.x, 0.015, v.z)));
  }

  setPointScale(s) {
    this.material.uniforms.uScale.value = s;
  }

  setReducedMotion(r) {
    this.material.uniforms.uRate.value = r ? 0.03 : 0.11;
  }

  update(dt, t) {
    this.material.uniforms.uTime.value = t;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.grateGeo.dispose();
    this.grateMat.dispose();
  }
}
