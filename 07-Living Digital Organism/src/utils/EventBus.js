/**
 * Minimal pub/sub. Every meaningful organism event is published here so
 * sound, haptics or analytics can subscribe without touching scene code.
 *   'provoke'   { strength }         user click / tap
 *   'breath'    { phase, rate }      every inhale peak
 *   'proximity' { value }            cursor closeness changes
 *   'mutate'    { generation }       idle evolution step
 *   'chapter'   { index }            narrative section change
 */
export class EventBus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.map.get(type)?.delete(fn);
  }
  emit(type, payload) { this.map.get(type)?.forEach((fn) => fn(payload)); }
  clear() { this.map.clear(); }
}
