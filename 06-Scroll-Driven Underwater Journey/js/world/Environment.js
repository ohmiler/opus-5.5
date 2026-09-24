import * as THREE from 'three';

// Colour script for the descent: fog colour doubles as the background so the world has no horizon.
const STOPS = [
  { p: 0.0, fog: '#3a9cbd', d: 0.010, hemi: 2.4, sun: 3.0 },
  { p: 0.18, fog: '#16668c', d: 0.016, hemi: 1.5, sun: 1.6 },
  { p: 0.45, fog: '#072a45', d: 0.024, hemi: 0.5, sun: 0.3 },
  { p: 0.62, fog: '#020b16', d: 0.030, hemi: 0.1, sun: 0.0 },
  { p: 0.85, fog: '#01050b', d: 0.028, hemi: 0.05, sun: 0.0 },
  { p: 1.0, fog: '#021320', d: 0.021, hemi: 0.08, sun: 0.0 },
].map((s) => ({ ...s, color: new THREE.Color(s.fog) }));

export class Environment {
  constructor(scene) {
    this.color = new THREE.Color(STOPS[0].fog);
    this.fog = new THREE.FogExp2(this.color.getHex(), STOPS[0].d);
    scene.fog = this.fog;
    scene.background = this.color;

    this.hemi = new THREE.HemisphereLight('#bfefff', '#0a2030', 2);
    this.sun = new THREE.DirectionalLight('#e6fbff', 3);
    this.sun.position.set(10, 50, 10);
    scene.add(this.hemi, this.sun);
  }

  update(p) {
    let i = 1;
    while (i < STOPS.length - 1 && p > STOPS[i].p) i++;
    const a = STOPS[i - 1];
    const b = STOPS[i];
    const t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
    this.color.lerpColors(a.color, b.color, t);
    this.fog.color.copy(this.color);
    this.fog.density = a.d + (b.d - a.d) * t;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * t;
    this.sun.intensity = a.sun + (b.sun - a.sun) * t;
  }
}
