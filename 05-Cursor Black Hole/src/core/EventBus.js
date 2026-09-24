/**
 * Interaction events flow through here: `press`, `detonate`, `chapter`, `hover`, `field`.
 * Visuals and sound subscribe independently, so either can be swapped without touching input code.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(type, fn) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._handlers.get(type)?.delete(fn);
  }

  emit(type, detail = {}) {
    this._handlers.get(type)?.forEach((fn) => fn(detail));
  }
}
