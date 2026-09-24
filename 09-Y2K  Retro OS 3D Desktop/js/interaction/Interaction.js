import * as THREE from 'three';

const DRAG_THRESHOLD = 5;
const DOUBLE_MS = 380;

/**
 * Pointer → 3D: hover picking (once per frame), drag with desk-plane projection,
 * click and double-click detection that also works for touch (double-tap).
 */
export class Interaction {
  constructor({ dom, rig, world, handlers }) {
    this.dom = dom;
    this.rig = rig;
    this.world = world;
    this.h = handlers;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2(-10, -10);
    this.hovered = null;
    this.down = null;
    this.drag = null;
    this.last = { item: null, time: 0 };
    this.needsPick = false;
    this.local = new THREE.Vector2();

    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
    this.onLeave = () => { this.ndc.set(-10, -10); this.needsPick = true; world.ctx.pointerActive = false; };

    dom.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove, { passive: true });
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    dom.addEventListener('pointerleave', this.onLeave);
    dom.addEventListener('wheel', this.onWheel, { passive: true });
    // Backup for input paths that only deliver a native dblclick.
    this.onNativeDbl = (e) => {
      if (performance.now() - this.lastDouble < 500) return;
      this.setNDC(e);
      const item = this.pick();
      if (item) { this.lastDouble = performance.now(); this.h.onDoubleClick?.(item, e); }
    };
    this.lastDouble = 0;
    dom.addEventListener('dblclick', this.onNativeDbl);
  }

  setNDC(e) {
    this.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
  }

  pick() {
    this.raycaster.setFromCamera(this.ndc, this.rig.camera);
    const hits = this.raycaster.intersectObjects(this.world.pickables, true);
    for (const h of hits) {
      const item = h.object.userData.item;
      if (item && !item.captured && item.appear > 0.5) return item;
    }
    return null;
  }

  onDown(e) {
    if (e.button !== undefined && e.button !== 0) return;
    this.setNDC(e);
    const item = this.pick();
    this.down = { x: e.clientX, y: e.clientY, item, id: e.pointerId };
    this.h.onPress?.(e);
    if (item) {
      this.dom.setPointerCapture?.(e.pointerId);
      this.setHovered(item);
    }
  }

  onMove(e) {
    this.setNDC(e);
    this.needsPick = true;
    this.rig.setPointer(this.ndc.x, this.ndc.y);
    if (e.target === this.dom || this.drag) {
      const p = this.world.projectRay(this.raycaster.ray, 0, this.local);
      if (p) { this.world.ctx.pointer.copy(p); this.world.ctx.pointerActive = true; }
    }

    const d = this.down;
    if (d && d.item && !this.drag && Math.hypot(e.clientX - d.x, e.clientY - d.y) > DRAG_THRESHOLD) {
      const item = d.item;
      const hit = this.world.projectRay(this.raycaster.ray, item.height, new THREE.Vector2());
      if (hit) {
        this.drag = { item, offset: item.pos.clone().sub(hit) };
        item.dragging = true;
        item.dragTarget.copy(item.pos);
        item.onGrab();
        this.h.onDragStart?.(item);
      }
    }
    if (this.drag) {
      const { item, offset } = this.drag;
      const hit = this.world.projectRay(this.raycaster.ray, item.height, new THREE.Vector2());
      if (hit) item.dragTarget.copy(hit.add(offset));
    }
  }

  onUp(e) {
    const d = this.down;
    this.down = null;
    if (this.drag) {
      const { item } = this.drag;
      item.dragging = false;
      item.onDrop();
      this.drag = null;
      this.h.onDragEnd?.(item);
      this.needsPick = true;
      return;
    }
    if (!d || !d.item) return;
    const item = d.item;
    const now = performance.now();
    if (this.last.item === item && now - this.last.time < DOUBLE_MS) {
      this.last = { item: null, time: 0 };
      this.lastDouble = now;
      this.h.onDoubleClick?.(item, e);
    } else {
      this.last = { item, time: now };
      this.h.onClick?.(item, e);
    }
    if (e.pointerType !== 'mouse') this.setHovered(null);
  }

  onWheel(e) {
    this.rig.nudgeZoom(Math.sign(e.deltaY) * 0.04);
  }

  setHovered(item) {
    if (item === this.hovered) return;
    this.hovered?.setHover(false);
    this.hovered = item;
    item?.setHover(true);
    this.h.onHoverChange?.(item);
  }

  update() {
    if (!this.needsPick || this.drag) return;
    this.needsPick = false;
    this.setHovered(this.pick());
  }

  dispose() {
    this.dom.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    this.dom.removeEventListener('pointerleave', this.onLeave);
    this.dom.removeEventListener('wheel', this.onWheel);
    this.dom.removeEventListener('dblclick', this.onNativeDbl);
  }
}
