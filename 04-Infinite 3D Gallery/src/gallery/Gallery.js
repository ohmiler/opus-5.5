import * as THREE from 'three';
import { Card } from './Card.js';
import { TextPlane, fonts, setTracking } from './TextPlane.js';
import { ArtworkFactory } from './ArtworkFactory.js';
import { composeLayout } from './layout.js';
import { projects, rooms, ROOM_SIZE } from './projects.js';
import { mod, damp } from '../utils/math.js';
import { env } from '../utils/env.js';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

// The endless corridor: builds cards and room titles, wraps them around the
// camera, and answers questions about "where am I" for the UI.
export class Gallery {
  constructor(stage) {
    this.stage = stage;
    this.root = new THREE.Group();
    stage.add(this.root);
    this.cards = [];
    this.markers = [];
    this.behind = 6;
    this.raycaster = new THREE.Raycaster();
    this.meshes = [];
  }

  get total() {
    return projects.length;
  }

  // Builds everything, yielding a frame per artwork so progress can paint.
  async build(onProgress) {
    const { slots, markers, loop } = composeLayout({ count: projects.length, roomSize: ROOM_SIZE });
    this.loop = loop;
    const factory = new ArtworkFactory({ maxSize: env.touch ? 640 : 1024 });
    const segments = env.touch ? 12 : 24;
    const atmosphere = this.stage.atmosphere;

    for (let i = 0; i < projects.length; i++) {
      const canvas = factory.paint(projects[i], i);
      const card = new Card({
        project: projects[i],
        index: i,
        total: projects.length,
        room: Math.floor(i / ROOM_SIZE),
        canvas,
        slot: slots[i],
        atmosphere,
        segments,
      });
      this.cards.push(card);
      this.meshes.push(card.mesh);
      this.root.add(card.group);
      onProgress?.((i + 1) / (projects.length + markers.length));
      await nextFrame();
    }

    markers.forEach((m, i) => {
      const room = rooms[m.room];
      const plane = new TextPlane({
        width: 11,
        pxWidth: 2048,
        pxHeight: 640,
        atmosphere,
        color: 0xece7de,
        opacity: 0,
        fade: [2.5, 11],
        draw: (ctx, w, h) => {
          ctx.fillStyle = '#fff';
          ctx.textAlign = 'center';
          ctx.font = `500 34px ${fonts.mono}`;
          setTracking(ctx, 12);
          ctx.fillText(`ROOM ${room.numeral}`, w / 2, 120);
          ctx.font = `italic 400 420px ${fonts.serif}`;
          setTracking(ctx, -8);
          ctx.fillText(room.name, w / 2, 500);
        },
      });
      plane.mesh.position.set(0, 0.9, m.z);
      this.root.add(plane.mesh);
      this.markers.push({ plane, z: m.z, room: m.room, reveal: 0, dim: 0 });
      onProgress?.((projects.length + i + 1) / (projects.length + markers.length));
    });
  }

  setViewport(aspect) {
    const portrait = aspect < 0.8;
    this.cards.forEach((c) => {
      c.xScale = portrait ? 0.38 : aspect < 1.2 ? 0.75 : 1;
      c.sizeScale = portrait ? 0.78 : 1;
    });
    this.markers.forEach((m) => m.plane.mesh.scale.setScalar(portrait ? 0.55 : 1));
  }

  // Staggered entrance, nearest works first.
  reveal(time) {
    const order = [...this.cards].sort((a, b) => b.slot.z - a.slot.z);
    order.forEach((card, i) => (card.revealAt = time + 0.9 + i * 0.12));
    this.revealTime = time;
  }

  update(dt, state) {
    const s = { ...state, loop: this.loop, behind: this.behind };
    for (const card of this.cards) card.update(dt, s);

    for (const m of this.markers) {
      const rel = mod(m.z - s.camZ - this.behind, this.loop) - this.loop + this.behind;
      m.plane.mesh.position.z = s.camZ + rel;
      if (this.revealTime !== undefined && s.time > this.revealTime + 0.4) {
        m.reveal = Math.min(1, m.reveal + dt * 0.6);
      }
      m.dim = damp(m.dim, this.dimAll || 0, 3.2, dt);
      m.plane.opacity = m.reveal * 0.92 * (1 - m.dim);
    }
  }

  pick(pointer, camera) {
    this.raycaster.setFromCamera(pointer, camera);
    const hits = this.raycaster.intersectObjects(this.meshes, false);
    for (const hit of hits) {
      const card = hit.object.userData.card;
      if (card.reveal > 0.6 && card.dim < 0.3) return card;
    }
    return null;
  }

  // The work nearest ahead of the camera — drives the HUD.
  nearest(camZ) {
    let best = null;
    let bestD = Infinity;
    for (const c of this.cards) {
      if (c.worldZ > camZ - 1) continue; // only works ahead of the lens
      const d = Math.abs(c.worldZ - (camZ - 7));
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  progress(camZ) {
    return mod(-camZ, this.loop) / this.loop;
  }

  focus(card) {
    this.dimAll = 1;
    for (const c of this.cards) {
      c.focusTarget = c === card ? 1 : 0;
      c.dimTarget = c === card ? 0 : 1;
      c.hoverTarget = 0;
    }
  }

  unfocus() {
    this.dimAll = 0;
    for (const c of this.cards) {
      c.focusTarget = 0;
      c.dimTarget = 0;
    }
  }

  // Next/previous work, framed in the direction of travel. The wrapped
  // position of a far card can sit on the "wrong" side of the loop, so the
  // target depth is derived from the current card instead.
  neighbour(card, dir) {
    const next = this.cards[mod(card.index + dir, this.cards.length)];
    let delta = next.slot.z - card.slot.z;
    if (dir > 0 && delta > 0) delta -= this.loop;
    if (dir < 0 && delta < 0) delta += this.loop;
    return { card: next, framing: { ...next.framing, z: card.worldZ + delta } };
  }

  dispose() {
    this.cards.forEach((c) => c.dispose());
    this.markers.forEach((m) => m.plane.dispose());
    this.stage.scene.remove(this.root);
    this.cards = [];
    this.markers = [];
    this.meshes = [];
  }
}
