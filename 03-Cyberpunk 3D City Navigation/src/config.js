// Global art direction + device-dependent quality settings.

export const PALETTE = {
  ink: 0x05060d,
  fog: 0x0d0a1c,
  skyTop: 0x020309,
  skyHorizon: 0x1d0f2e,
  cyan: '#19f0ff',
  magenta: '#ff2bd6',
  amber: '#ffb13b',
  violet: '#8f7bff',
  lamp: '#9fc4ff',
};

// Street layout (meters). The avenue runs along -Z.
export const STREET = {
  roadHalf: 7,
  walkHalf: 11.5,
  start: 36,
  end: -106,
  crossZ: -64, // cross street
};

// Layers: 0 = main camera, 2 = visible in wet-street reflection, 5 = picking proxies.
export const LAYERS = { REFLECT: 2, PICK: 5 };

export function detectQuality() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  const mobile = coarse || small;
  const cores = navigator.hardwareConcurrency || 4;
  const tier = mobile ? 'low' : cores <= 4 ? 'medium' : 'high';

  return {
    tier,
    mobile,
    finePointer: window.matchMedia('(pointer: fine)').matches,
    maxDpr: { high: 1.75, medium: 1.5, low: 1.25 }[tier],
    reflections: tier !== 'low',
    reflectionScale: tier === 'high' ? 0.5 : 0.35,
    rain: { high: 9000, medium: 6500, low: 2600 }[tier],
    splashes: { high: 380, medium: 260, low: 110 }[tier],
    traffic: { high: 30, medium: 24, low: 14 }[tier],
    steam: { high: 70, medium: 50, low: 28 }[tier],
  };
}

export function watchReducedMotion(cb) {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = () => cb(mq.matches);
  mq.addEventListener?.('change', handler);
  return { value: mq.matches, stop: () => mq.removeEventListener?.('change', handler) };
}
