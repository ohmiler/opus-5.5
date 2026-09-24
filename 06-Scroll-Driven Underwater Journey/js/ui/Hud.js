const DEPTH = [[0, 0], [0.2, 200], [0.5, 1000], [0.8, 4000], [1, 4600]];
const ZONES = [[0, 'Sunlight Zone'], [0.2, 'Twilight Zone'], [0.5, 'Midnight Zone'], [0.8, 'The Abyss']];

export function metresAt(p) {
  for (let i = 1; i < DEPTH.length; i++) {
    const [p1, m1] = DEPTH[i];
    const [p0, m0] = DEPTH[i - 1];
    if (p <= p1) return m0 + ((p - p0) / (p1 - p0)) * (m1 - m0);
  }
  return DEPTH[DEPTH.length - 1][1];
}

export class Hud {
  constructor(onZone) {
    this.onZone = onZone;
    this.depth = document.querySelector('.gauge__depth');
    this.fill = document.querySelector('.gauge__fill');
    this.marker = document.querySelector('.gauge__marker');
    this.zoneEl = document.querySelector('.gauge__zone');
    this.zone = 0;
    this.lastM = -1;
  }

  update(p) {
    const m = Math.round(metresAt(p));
    if (m !== this.lastM) {
      this.lastM = m;
      this.depth.textContent = String(m).padStart(4, '0');
      this.fill.style.transform = `scaleY(${p})`;
      this.marker.style.top = `${p * 100}%`;
    }
    let z = 0;
    for (let i = 0; i < ZONES.length; i++) if (p >= ZONES[i][0]) z = i;
    if (z !== this.zone) {
      const prev = this.zone;
      this.zone = z;
      this.zoneEl.classList.add('is-swap');
      setTimeout(() => {
        this.zoneEl.textContent = ZONES[z][1];
        this.zoneEl.classList.remove('is-swap');
      }, 350);
      this.onZone(z, prev);
    }
  }
}
