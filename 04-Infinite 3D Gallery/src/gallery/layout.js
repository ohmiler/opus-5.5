import { mulberry32, lerp } from '../utils/math.js';

// Procedural composition.
//
// Random enough to feel found, ruled enough to feel curated:
//  - Works alternate sides of a clear central walkway, like hanging walls.
//  - Vertical offsets counter the previous piece so the eye zig-zags.
//  - Sizes follow a large / small / medium rhythm with jitter.
//  - Each room opens with a "feature" work hung almost on the axis,
//    right after the room's title, so the camera meets it head-on.
//  - Works turn slightly toward the walkway, as if angled for the visitor.

export function composeLayout({ count, roomSize, seed = 7, compact = false }) {
  const rand = mulberry32(seed);
  const spacing = compact ? 5.6 : 6.4;
  const roomGap = 9;
  const spreadX = compact ? 0.42 : 1;
  const sizeK = compact ? 0.82 : 1;
  const rhythm = [1.18, 0.82, 1.0];

  const slots = [];
  const markers = [];
  let z = -12;
  let side = rand() < 0.5 ? -1 : 1;
  let prevY = 0;

  for (let i = 0; i < count; i++) {
    const inRoom = i % roomSize;
    if (inRoom === 0) {
      markers.push({ z, room: i / roomSize });
      z -= roomGap;
    }

    const feature = inRoom === 0;
    const size = (feature ? 3.5 : 2.9 * rhythm[i % 3] + (rand() - 0.5) * 0.4) * sizeK;

    let x;
    if (feature) {
      x = (rand() < 0.5 ? -1 : 1) * lerp(0.5, 1.1, rand()) * spreadX;
    } else {
      x = side * (1.7 + size * 0.45 + rand() * 1.1) * spreadX;
      // Occasionally hang two consecutive works on the same wall.
      if (rand() > 0.2) side *= -1;
    }

    let y = -Math.sign(prevY || 1) * lerp(0.15, 1.15, rand());
    if (feature) y = lerp(-0.2, 0.35, rand());
    prevY = y;

    slots.push({
      x,
      y,
      z: z + (rand() - 0.5) * 1.4,
      size,
      ry: feature ? (rand() - 0.5) * 0.08 : -Math.sign(x) * lerp(0.1, 0.24, rand()),
      rz: (rand() - 0.5) * 0.035,
    });

    z -= spacing * lerp(0.85, 1.2, rand()) * (feature ? 1.25 : 1);
  }

  // Closing gap before the corridor loops to room I again.
  // (first marker sits at z = -12; its wrapped copy lands at -12 - loop).
  const loop = -z - 12 + spacing * 1.5;
  return { slots, markers, loop };
}
