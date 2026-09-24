// Tracks GPU resources owned by a component and frees them in one call.
export class Disposer {
  #items = new Set();

  track(resource) {
    if (resource) this.#items.add(resource);
    return resource;
  }

  // Track every geometry / material / texture under an Object3D.
  trackObject(root) {
    root.traverse((o) => {
      if (o.geometry) this.track(o.geometry);
      const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
      for (const m of mats) {
        this.track(m);
        for (const v of Object.values(m)) if (v && v.isTexture) this.track(v);
        if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value?.isTexture) this.track(u.value);
      }
    });
    return root;
  }

  dispose() {
    for (const r of this.#items) r.dispose?.();
    this.#items.clear();
  }
}
