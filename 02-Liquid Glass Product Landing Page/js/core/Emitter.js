/** Minimal event bus shared by interaction, UI and sound layers. */
export class Emitter {
  #handlers = new Map();

  on(event, fn) {
    if (!this.#handlers.has(event)) this.#handlers.set(event, new Set());
    this.#handlers.get(event).add(fn);
    return () => this.#handlers.get(event)?.delete(fn);
  }

  emit(event, payload) {
    this.#handlers.get(event)?.forEach((fn) => fn(payload));
  }

  clear() {
    this.#handlers.clear();
  }
}
