const mq = (q) => window.matchMedia?.(q).matches ?? false;

/**
 * Picks a simulation budget for this device. `?particles=128|192|256` overrides it for testing.
 * The sim is a square texture, so the body count is simSize².
 */
export function detectDevice() {
  const coarse = mq('(pointer: coarse)') && !mq('(pointer: fine)');
  const small = Math.min(window.screen?.width ?? innerWidth, window.screen?.height ?? innerHeight) < 768;
  const reducedMotion = mq('(prefers-reduced-motion: reduce)');
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 8;

  let simSize = 256;
  if (coarse || small) simSize = 128;
  else if (cores <= 4 || memory <= 4) simSize = 192;

  const override = Number(new URLSearchParams(location.search).get('particles'));
  if ([64, 128, 192, 256, 384].includes(override)) simSize = override;

  return { coarse, small, reducedMotion, simSize, maxDpr: coarse ? 1.5 : 2 };
}

export function supportsWebGL2() {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
