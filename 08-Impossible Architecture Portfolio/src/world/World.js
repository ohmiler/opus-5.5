import * as THREE from 'three';
import { concreteTexture, typeTexture } from '../utils/textures.js';
import { Installation } from './Installation.js';
import { damp, easeInOutCubic, lerpAngle, range, smoother } from '../utils/math.js';

const SERIF = '"Instrument Serif", serif';
const MONO = '"JetBrains Mono", monospace';
const FOG = 0xd4cbbd;
const UV_SCALE = 0.22; // texture tiles per world unit

/** Scale box UVs by face dimensions so concrete grain has constant world density. */
function scaleBoxUV(geo, w, h, d) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const idx = f * 4 + i;
    uv.setXY(idx, uv.getX(idx) * dims[f][0] * UV_SCALE, uv.getY(idx) * dims[f][1] * UV_SCALE);
  }
}

/**
 * Builds and animates the architecture. Sections, in travel order:
 * Threshold → Corridor of Recurrence → Rotating Room → Inversion (stairs) → Floating Rooms → Horizon.
 */
export class World {
  constructor(scene, rig, { mobile, reduced }) {
    this.scene = scene;
    this.rig = rig;
    this.mobile = mobile;
    this.reduced = reduced;
    this.installations = [];
    this.occluders = [];
    this.floaters = [];
    this._fwd = new THREE.Vector3();
    this._grav = new THREE.Vector3();
  }

  /* ---------- building blocks ---------- */

  box(w, h, d, mat, x, y, z, parent = this.scene, { cast = true } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    scaleBoxUV(geo, w, h, d);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.occluders.push(mesh);
    return mesh;
  }

  /** Floating step blocks: stairs without stringers read as more impossible. */
  stair(steps, width, rise, run, mat) {
    const g = new THREE.Group();
    for (let i = 0; i < steps; i++) this.box(width, rise, run, mat, 0, i * rise + rise / 2, -i * run, g);
    return g;
  }

  type(w, h, texW, texH, items, opacity = 0.9) {
    const tex = typeTexture(texW, texH, items);
    const mat = new THREE.MeshBasicMaterial({
      map: tex, transparent: true, opacity, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.renderOrder = 2;
    return mesh;
  }

  /* ---------- build steps (called by the loader) ---------- */

  buildMaterials() {
    this.concreteTex = concreteTexture();
    this.mat = {
      concrete: new THREE.MeshStandardMaterial({ map: this.concreteTex, color: 0xe6e0d6, roughness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ map: this.concreteTex, color: 0x9b958c, roughness: 0.97 }),
      ground: new THREE.MeshStandardMaterial({ map: this.concreteTex, color: 0xc4bdb2, roughness: 1 }),
      far: new THREE.MeshStandardMaterial({ color: 0xbfb7ab, roughness: 1 }),
      accent: new THREE.MeshBasicMaterial({ color: 0xc4411f }),
      glow: new THREE.MeshBasicMaterial({ color: 0xfff7ea, toneMapped: false }),
    };
  }

  buildEnvironment() {
    const { scene } = this;
    scene.background = new THREE.Color(FOG);
    scene.fog = new THREE.Fog(FOG, 22, 175);

    scene.add(new THREE.HemisphereLight(0xf6efe3, 0x5d574f, 1.1));

    const sun = (this.sun = new THREE.DirectionalLight(0xffefd8, 3.2));
    sun.castShadow = true;
    const size = this.mobile ? 1024 : 2048;
    sun.shadow.mapSize.set(size, size);
    Object.assign(sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 1, far: 240 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.04;
    this.sunOffset = new THREE.Vector3(42, 74, 18);
    scene.add(sun, sun.target);

    const groundGeo = new THREE.PlaneGeometry(1400, 1400);
    const uv = groundGeo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1400 * UV_SCALE, uv.getY(i) * 1400 * UV_SCALE);
    const ground = new THREE.Mesh(groundGeo, this.mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.position.z = -150;
    ground.receiveShadow = true;
    scene.add(ground);

    // Distant monoliths: one instanced draw call gives the sense of an endless city of slabs.
    const count = this.mobile ? 70 : 160;
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.mat.far, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (34 + Math.random() * 200);
      const z = 80 - Math.random() * 540;
      const w = 4 + Math.random() * 22, h = 18 + Math.random() * 120, d = 4 + Math.random() * 22;
      const floating = Math.random() < 0.18 ? 20 + Math.random() * 60 : 0;
      p.set(x, h / 2 + floating, z);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() < 0.8 ? 0 : Math.random() * Math.PI);
      s.set(w, h, d);
      inst.setMatrixAt(i, m.compose(p, q, s));
    }
    scene.add(inst);
    this.farField = inst;
  }

  buildArchitecture() {
    this.buildThreshold();
    this.buildCorridor();
    this.buildRotatingRoom();
    this.buildInversion();
    this.buildFloatingRooms();
    this.buildHorizon();
    this.buildDust();
  }

  buildThreshold() {
    const { concrete, dark } = this.mat;
    this.box(18, 34, 3, concrete, -14, 17, 0);
    this.box(18, 34, 3, concrete, 14, 17, 0);
    this.box(48, 5, 4, dark, 0, 42, 0); // lintel hovering above its own supports

    const title = this.type(34, 8.5, 2048, 512, [
      { text: 'Monolith', font: `400 440px ${SERIF}`, x: 0.5, y: 0.52, spacing: '-8px' },
    ]);
    title.position.set(0, 25, 1.56);
    this.scene.add(title);
    const sub = this.type(30, 1.2, 2048, 82, [
      { text: 'AN ARCHIVE OF IMPOSSIBLE ROOMS  ·  EIGHT WORKS  ·  2022 — 2026', font: `500 40px ${MONO}`, x: 0.5, y: 0.5, spacing: '10px' },
    ]);
    sub.position.set(0, 19.8, 1.56);
    this.scene.add(sub);

    // A stair that climbs into the fog and never arrives.
    const s = this.stair(34, 3, 0.9, 1.6, dark);
    s.position.set(-30, 0, 10);
    this.scene.add(s);
  }

  buildCorridor() {
    const { concrete, dark } = this.mat;
    for (let i = 0; i < 15; i++) {
      const z = -6 - i * 6;
      this.box(1.2, 12, 1.2, concrete, -5.6, 6, z);
      this.box(1.2, 12, 1.2, concrete, 5.6, 6, z);
      this.box(12.4, 1, 1.2, concrete, 0, 12.5, z);
      for (let k = 1; k < 4; k++) this.box(12.4, 0.35, 0.45, dark, 0, 12.1, z - k * 1.5);
      const zc = z - 3;
      this.box(0.6, 12, 4.8, concrete, -6, 6, zc);
      // Gaps in the sunward wall throw blades of light across the floor.
      if (i % 3 !== 1) this.box(0.6, 12, 4.8, concrete, 6, 6, zc);
    }

    const floorType = this.type(9, 4.5, 1024, 512, [
      { text: '02', font: `500 34px ${MONO}`, x: 0.5, y: 0.18, spacing: '6px' },
      { text: 'Corridor of', font: `italic 400 150px ${SERIF}`, x: 0.5, y: 0.48 },
      { text: 'Recurrence', font: `italic 400 150px ${SERIF}`, x: 0.5, y: 0.78 },
    ], 0.75);
    floorType.rotation.x = -Math.PI / 2;
    floorType.position.set(0, 0.02, -15);
    this.scene.add(floorType);
  }

  buildRotatingRoom() {
    const { concrete, dark } = this.mat;
    const room = (this.room = new THREE.Group());
    room.position.set(0, 7, -110);
    this.scene.add(room);

    // Shell 16×16×23 with square 6×6 doors centred on the rotation axis,
    // so the doorways map onto themselves after a 90° turn.
    this.box(1, 16, 22, concrete, -7.5, 0, 0, room);
    this.box(1, 16, 22, concrete, 7.5, 0, 0, room);
    this.box(16, 1, 22, dark, 0, -7.5, 0, room);
    this.box(7.4, 1, 22, concrete, -4.3, 7.5, 0, room);
    this.box(7.4, 1, 22, concrete, 4.3, 7.5, 0, room); // skylight slot between
    for (const z of [11.5, -11.5]) {
      this.box(16, 5, 1, concrete, 0, 5.5, z, room);
      this.box(16, 5, 1, concrete, 0, -5.5, z, room);
      this.box(5, 6, 1, concrete, -5.5, 0, z, room);
      this.box(5, 6, 1, concrete, 5.5, 0, z, room);
    }
    const lamp = new THREE.PointLight(0xffe2c4, 70, 26, 2);
    room.add(lamp);

    const text = this.type(12, 1.9, 1536, 244, [
      { text: '03 — The room turns ninety degrees.', font: `italic 400 92px ${SERIF}`, x: 0.5, y: 0.34 },
      { text: 'YOU DO NOT', font: `500 34px ${MONO}`, x: 0.5, y: 0.8, spacing: '12px' },
    ]);
    text.position.set(0, 4.6, -10.94);
    room.add(text);
  }

  buildInversion() {
    const { concrete, dark } = this.mat;
    this.box(46, 2, 82, concrete, 0, 23, -166);
    for (const x of [-17, 17]) for (const z of [-138, -166, -194]) this.box(3, 22, 3, dark, x, 11, z);

    const a = this.stair(16, 4, 0.7, 1.3, concrete);
    a.position.set(9, 0, -128);
    const b = this.stair(16, 4, 0.7, 1.3, concrete);
    b.rotation.z = Math.PI;
    b.position.set(-9, 22, -146);
    const c = this.stair(14, 3, 0.8, 1.4, dark);
    c.rotation.z = -Math.PI / 2;
    c.position.set(-15.5, 5, -168);
    this.scene.add(a, b, c);

    // Square spiral that climbs into the ceiling.
    for (let i = 0; i < 4; i++) {
      const f = this.stair(7, 2.6, 0.62, 1.2, concrete);
      f.rotation.y = (-i * Math.PI) / 2;
      const corner = [[7, -178], [7, -187], [16, -187], [16, -178]][i];
      f.position.set(corner[0] + 2, i * 4.34, corner[1]);
      this.scene.add(f);
    }

    const ceiling = this.type(18, 6, 1536, 512, [
      { text: '04 · INVERSION', font: `500 36px ${MONO}`, x: 0.5, y: 0.22, spacing: '10px' },
      { text: 'Gravity is a suggestion.', font: `italic 400 150px ${SERIF}`, x: 0.5, y: 0.6 },
    ], 0.8);
    ceiling.rotation.set(Math.PI / 2, 0, Math.PI);
    ceiling.position.set(0, 21.96, -176);
    this.scene.add(ceiling);
  }

  buildFloatingRooms() {
    const specs = [
      { pos: [-11, 11, -224], rot: [0, 1.1, 0], track: 1, screen: 5 },
      { pos: [13, 16, -238], rot: [Math.PI, -0.6, 0.2], track: 0 },
      { pos: [10, 7, -262], rot: [0, -1.2, 0], track: 1, screen: 7 },
      { pos: [-14, 19, -284], rot: [0.3, 0.8, Math.PI / 2], track: 0 },
      { pos: [22, 26, -300], rot: [-0.4, 0.2, 0.6], track: 0 },
    ];
    for (const s of specs) {
      const g = new THREE.Group();
      g.position.set(...s.pos);
      g.rotation.set(...s.rot);
      const { concrete, dark } = this.mat;
      this.box(8.6, 8.6, 0.6, concrete, 0, 0, -4, g);
      this.box(0.6, 8.6, 8.6, concrete, -4, 0, 0, g);
      this.box(0.6, 8.6, 5.2, concrete, 4, 0, -1.7, g); // slot on one side lets light in
      this.box(8.6, 0.6, 8.6, dark, 0, -4, 0, g);
      this.box(8.6, 0.6, 8.6, concrete, 0, 4, 0, g);
      this.scene.add(g);
      this.floaters.push({ group: g, base: g.position.clone(), yaw: s.rot[1], track: s.track, phase: Math.random() * 6, screenIndex: s.screen });
    }

    const t = this.type(10, 5, 1024, 512, [
      { text: '05', font: `500 34px ${MONO}`, x: 0.5, y: 0.18, spacing: '6px' },
      { text: 'Floating', font: `italic 400 150px ${SERIF}`, x: 0.5, y: 0.48 },
      { text: 'Rooms', font: `italic 400 150px ${SERIF}`, x: 0.5, y: 0.78 },
    ], 0.7);
    t.rotation.x = -Math.PI / 2;
    t.position.set(0, 0.02, -212);
    this.scene.add(t);
  }

  buildHorizon() {
    const { concrete, glow } = this.mat;
    this.box(38, 60, 4, concrete, -21, 30, -346);
    this.box(38, 60, 4, concrete, 21, 30, -346);
    this.box(4, 53, 4, concrete, 0, 33.5, -346);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(4, 7), glow);
    door.position.set(0, 3.5, -347.5);
    this.scene.add(door);

    const t = this.type(40, 9, 2048, 460, [
      { text: 'The archive continues.', font: `italic 400 210px ${SERIF}`, x: 0.5, y: 0.45 },
      { text: 'BEYOND THIS DOOR, THE BUILDING BEGINS AGAIN', font: `500 38px ${MONO}`, x: 0.5, y: 0.86, spacing: '10px' },
    ]);
    t.position.set(0, 17, -343.9);
    this.scene.add(t);

    const s = this.stair(20, 3, 0.8, 1.4, this.mat.dark);
    s.position.set(12, 0, -312);
    this.scene.add(s);
  }

  /** Dust drifts toward whatever the camera currently considers "down". */
  buildDust() {
    const n = this.mobile ? 260 : 650;
    const pos = new Float32Array(n * 3);
    this.dustSize = new THREE.Vector3(40, 26, 44);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.dustSize.x;
      pos[i * 3 + 1] = Math.random() * this.dustSize.y;
      pos[i * 3 + 2] = 30 - Math.random() * this.dustSize.z;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0x4a443d, size: 0.07, transparent: true, opacity: 0.5, depthWrite: false,
    }));
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  buildInstallations(projects) {
    const materials = this.mat;
    const add = (index, opts, parent, pos, quat) => {
      const inst = new Installation(projects[index], { materials, ...opts });
      inst.group.position.set(...pos);
      if (quat) inst.group.quaternion.copy(quat);
      parent.add(inst.group);
      this.installations.push(inst);
      return inst;
    };
    const qY = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), a);
    const qZ = (a) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);

    // Corridor: mounted on wall panels.
    add(0, {}, this.scene, [-5.62, 4.4, -21], qY(Math.PI / 2));
    add(1, {}, this.scene, [5.62, 4.4, -39], qY(-Math.PI / 2));
    add(2, {}, this.scene, [-5.62, 4.4, -57], qY(Math.PI / 2));

    // Rotating room: one work on the floor, one on the ceiling. After the 90° turn they hang as walls.
    const size = { width: 4, height: 5.6 };
    add(3, size, this.room, [0, -6.93, -2], qZ(-Math.PI / 2).multiply(qY(-Math.PI / 2)));
    add(6, size, this.room, [0, 6.93, 3], qZ(-Math.PI / 2).multiply(qY(Math.PI / 2)));

    // Inversion: a monolith hanging from the ceiling, upright only once gravity has flipped.
    const hanging = add(4, { type: 'monolith', width: 4.2, height: 6 }, this.scene, [-7, 15.2, -182]);
    hanging.group.quaternion.copy(qY(0.45)).multiply(qZ(Math.PI));

    // Floating rooms: screens on their back walls; the rooms turn to face the visitor.
    for (const f of this.floaters) {
      if (f.screenIndex === undefined) continue;
      add(f.screenIndex, { type: 'screen', width: 6.4, height: 4 }, f.group, [0, 0, -3.64]);
    }
  }

  /** Scroll ranges derived from geometry so choreography stays in sync with the path. */
  computeTimeline() {
    this.roomRange = [this.rig.scrollAtZ(-101), this.rig.scrollAtZ(-118)];
  }

  update(s, t, dt) {
    const cam = this.rig.camera;
    if (!this.roomRange) this.computeTimeline();

    const turn = this.reduced ? 0 : easeInOutCubic(range(s, ...this.roomRange));
    this.room.rotation.z = turn * Math.PI * 0.5;

    for (const f of this.floaters) {
      const dx = cam.position.x - f.base.x, dz = cam.position.z - f.base.z;
      const near = smoother(1 - range(Math.hypot(dx, dz), 14, 50));
      const face = Math.atan2(dx, dz);
      f.group.rotation.y = lerpAngle(f.yaw + (this.reduced ? 0 : t * 0.02 * (1 - f.track)), face, near * f.track);
      f.group.position.y = f.base.y + (this.reduced ? 0 : Math.sin(t * 0.45 + f.phase) * 0.45);
    }

    for (const inst of this.installations) inst.update(dt, t);

    // Sun and its shadow frustum follow the camera so shadows stay crisp everywhere.
    this._fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    this.sun.target.position.copy(cam.position).addScaledVector(this._fwd, 16);
    this.sun.target.position.y = 6;
    this.sun.position.copy(this.sun.target.position).add(this.sunOffset);

    this.updateDust(dt, cam);
  }

  updateDust(dt, cam) {
    const arr = this.dust.geometry.attributes.position.array;
    this._grav.set(0, -1, 0).applyQuaternion(cam.quaternion).multiplyScalar(this.reduced ? 0.05 : 0.35 * dt);
    const { x: sx, y: sy, z: sz } = this.dustSize;
    const c = cam.position;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += this._grav.x + Math.sin(i + arr[i + 1]) * 0.002;
      arr[i + 1] += this._grav.y;
      arr[i + 2] += this._grav.z;
      // Wrap the particle volume around the camera: an endless supply of dust.
      const rx = arr[i] - c.x, ry = arr[i + 1] - c.y, rz = arr[i + 2] - c.z;
      if (rx > sx / 2) arr[i] -= sx; else if (rx < -sx / 2) arr[i] += sx;
      if (ry > sy / 2) arr[i + 1] -= sy; else if (ry < -sy / 2) arr[i + 1] += sy;
      if (rz > sz / 2) arr[i + 2] -= sz; else if (rz < -sz / 2) arr[i + 2] += sz;
    }
    this.dust.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    for (const inst of this.installations) inst.dispose();
    const mats = new Set();
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
    });
    mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
    this.concreteTex?.dispose();
    this.sun?.shadow.map?.dispose();
    this.scene.clear();
  }
}
