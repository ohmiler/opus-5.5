import * as THREE from 'three';

/**
 * Shared material palette. Translucent plastics use physical transmission on
 * desktop and a cheaper alpha blend on mobile.
 */
export function createMaterials({ lite }) {
  const all = [];
  const reg = (m) => (all.push(m), m);
  const cache = new Map();

  const plastic = (color, opts = {}) => {
    const key = color + JSON.stringify(opts);
    if (cache.has(key)) return cache.get(key);
    const m = reg(new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.14,
      metalness: 0,
      transmission: lite ? 0 : 1,
      thickness: 0.7,
      ior: 1.42,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      attenuationColor: new THREE.Color(color),
      attenuationDistance: 1.2,
      transparent: lite,
      opacity: lite ? 0.8 : 1,
      ...opts,
    }));
    cache.set(key, m);
    return m;
  };

  return {
    plastic,
    chrome: reg(new THREE.MeshStandardMaterial({ color: 0xf2f9ff, metalness: 1, roughness: 0.06, envMapIntensity: 1.35 })),
    satin: reg(new THREE.MeshStandardMaterial({ color: 0xdfeaf5, metalness: 1, roughness: 0.28 })),
    pearl: reg(new THREE.MeshPhysicalMaterial({ color: 0xf1f6fb, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.1, sheen: 1, sheenColor: new THREE.Color('#bfe8ff') })),
    dark: reg(new THREE.MeshStandardMaterial({ color: 0x0b1a33, roughness: 0.45, metalness: 0.3 })),
    ink: reg(new THREE.MeshStandardMaterial({ color: 0x07122a, roughness: 0.2, metalness: 0.2 })),
    keycap: reg(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.35, clearcoat: 0.6 })),
    dispose() { all.forEach((m) => m.dispose()); },
  };
}
