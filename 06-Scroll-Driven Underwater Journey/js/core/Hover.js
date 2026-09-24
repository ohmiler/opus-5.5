/**
 * Central raycast-driven hover/click system. World components register hit meshes with handlers;
 * the cursor reflects whatever is under it.
 */
const isShown = (o) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };

export class Hover {
  constructor(pointer, cursor) {
    this.pointer = pointer;
    this.cursor = cursor;
    this.targets = [];
    this.current = null;
    this.frame = 0;
    this.touchTimer = 0;

    this.onDown = this.onDown.bind(this);
    addEventListener('pointerdown', this.onDown);
  }

  add(mesh, handlers) {
    mesh.userData.hover = handlers;
    this.targets.push(mesh);
  }

  pick() {
    const list = this.targets.filter(isShown);
    const hit = list.length ? this.pointer.raycaster.intersectObjects(list, false)[0] : null;
    const next = hit ? hit.object.userData.hover : null;
    if (next === this.current) return;
    this.current?.onLeave?.();
    this.current = next;
    next?.onEnter?.();
    this.cursor.setHover(next ? next.label : '');
  }

  update() {
    if (!this.pointer.active) {
      if (this.current && !this.touchTimer) {
        this.current.onLeave?.();
        this.current = null;
        this.cursor.setHover('');
      }
      return;
    }
    if (++this.frame % 2 === 0) this.pick();
  }

  onDown(e) {
    if (e.target.closest?.('button, a, .loader')) return;
    this.pick();
    this.current?.onClick?.();
    if (e.pointerType === 'touch') {
      clearTimeout(this.touchTimer);
      this.touchTimer = setTimeout(() => { this.touchTimer = 0; }, 1200);
    }
  }

  dispose() { removeEventListener('pointerdown', this.onDown); }
}
