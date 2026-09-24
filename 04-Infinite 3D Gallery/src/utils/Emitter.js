// Minimal event emitter used to decouple modules.
export class Emitter {
  constructor() {
    this._listeners = new Map();
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    this._listeners.get(type)?.forEach((fn) => fn(payload));
  }

  clear() {
    this._listeners.clear();
  }
}
