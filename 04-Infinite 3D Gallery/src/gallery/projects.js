// Placeholder archive. Each entry drives a procedurally painted artwork
// (see ArtworkFactory) so the gallery ships with zero image dependencies.
// Swap `image` in for a URL later and ArtworkFactory will load it instead.

export const rooms = [
  { numeral: 'I', name: 'Light' },
  { numeral: 'II', name: 'Matter' },
  { numeral: 'III', name: 'Signal' },
  { numeral: 'IV', name: 'Silence' },
];

export const projects = [
  // I — Light
  {
    title: 'Solstice Chamber',
    discipline: 'Spatial Installation',
    client: 'Kunsthal Rotterdam',
    year: 2025,
    style: 'orb',
    palette: ['#1a0f0a', '#ff6a2b', '#ffd2a1', '#2b0d05'],
    aspect: 0.8,
    description:
      'A single sphere of light tracks the sun across a windowless hall, compressing a full day into eleven minutes of slow, amber drift.',
  },
  {
    title: 'Afterimage',
    discipline: 'Photography',
    client: 'Self-initiated',
    year: 2024,
    style: 'bands',
    palette: ['#0c0d12', '#e8e3d6', '#7c8aa6', '#3a4257'],
    aspect: 1.5,
    description:
      'Long exposures of city light, re-printed as bands of pure colour — what remains in the eye after the scene has gone.',
  },
  {
    title: 'Low Sun Studies',
    discipline: 'Art Direction',
    client: 'Maison Arlo',
    year: 2024,
    style: 'gradient',
    palette: ['#2a1b3d', '#f28d6b', '#f7d9b5', '#6b3d6e'],
    aspect: 0.75,
    description:
      'Campaign imagery shot exclusively in the forty minutes before sunset, across six cities and one very patient crew.',
  },
  {
    title: 'Lumen Index',
    discipline: 'Generative System',
    client: 'Nordlys Foundation',
    year: 2023,
    style: 'rings',
    palette: ['#050608', '#c9f2ff', '#3a8fb7', '#0f2a3a'],
    aspect: 1,
    description:
      'A catalogue of 4,096 procedurally grown halos, each seeded by a single reading from an Arctic light sensor.',
  },
  {
    title: 'Glass Weather',
    discipline: 'Film Title Sequence',
    client: 'Portal Pictures',
    year: 2023,
    style: 'caustics',
    palette: ['#07121a', '#8fe3d2', '#f4fff9', '#1c4a52'],
    aspect: 1.6,
    description:
      'Refracted light through water-filled glass, filmed at 1,000 fps and slowed until it reads as climate rather than motion.',
  },
  // II — Matter
  {
    title: 'Monolith Series',
    discipline: 'Architecture Visualisation',
    client: 'Atelier Brun',
    year: 2025,
    style: 'blocks',
    palette: ['#141312', '#c7bba6', '#6e655a', '#e9e2d4'],
    aspect: 0.72,
    description:
      'Seven concrete volumes rendered only at dawn, studying how raw mass becomes soft when light arrives sideways.',
  },
  {
    title: 'Terrain / 0.4',
    discipline: 'Data Sculpture',
    client: 'Institute of Geology',
    year: 2024,
    style: 'contours',
    palette: ['#0e0f0b', '#d8d1a9', '#8a8457', '#3d3b27'],
    aspect: 1.35,
    description:
      'Contour data from a retreating glacier, milled in oak at 0.4mm resolution and scanned back into light.',
  },
  {
    title: 'Soft Brutal',
    discipline: 'Furniture',
    client: 'Studio Kallio',
    year: 2023,
    style: 'arches',
    palette: ['#1b1614', '#e0a58c', '#f3e3d3', '#7a4d3d'],
    aspect: 0.8,
    description:
      'A collection of cast-plaster seating that borrows from bunker geometry but refuses its hostility.',
  },
  {
    title: 'Ferrous',
    discipline: 'Material Research',
    client: 'Arc Metals',
    year: 2022,
    style: 'grain',
    palette: ['#120c0a', '#a4452c', '#e8b394', '#3f1d14'],
    aspect: 1,
    description:
      'Oxidation photographed over ninety days — a slow colour study authored entirely by rain.',
  },
  {
    title: 'Stone Choir',
    discipline: 'Exhibition Design',
    client: 'Museo Tamayo',
    year: 2022,
    style: 'pillars',
    palette: ['#0d0d0d', '#bfb8ad', '#58544d', '#f1ede6'],
    aspect: 1.5,
    description:
      'Forty basalt columns tuned to resonate at different pitches, arranged so visitors compose by walking.',
  },
  // III — Signal
  {
    title: 'Carrier Wave',
    discipline: 'Audio-Visual Performance',
    client: 'Sónar Barcelona',
    year: 2025,
    style: 'waves',
    palette: ['#05040a', '#6f5cff', '#d9d4ff', '#1d1648'],
    aspect: 1.6,
    description:
      'A live set where every oscillator is also a line of light, projected across a 40-metre scrim.',
  },
  {
    title: 'Noise Floor',
    discipline: 'Brand Identity',
    client: 'Static Records',
    year: 2024,
    style: 'dots',
    palette: ['#0a0a0a', '#f5f5f0', '#ff3b1f', '#2a2a2a'],
    aspect: 0.8,
    description:
      'An identity built from the hiss beneath recordings — halftone dots that shift with each release.',
  },
  {
    title: 'Relay',
    discipline: 'Interactive Installation',
    client: 'Ars Electronica',
    year: 2023,
    style: 'grid',
    palette: ['#03080a', '#35ffb0', '#0c3b2e', '#e6fff5'],
    aspect: 1,
    description:
      'A room-sized grid of sensors passing a single pulse between visitors, visualised as it hops body to body.',
  },
  {
    title: 'Interference',
    discipline: 'Editorial',
    client: 'Kinfolk',
    year: 2023,
    style: 'moire',
    palette: ['#101014', '#e9e4dc', '#9aa0b5', '#2c2f3d'],
    aspect: 0.72,
    description:
      'Moiré patterns printed on translucent stock, so every turned page produces a new, unrepeatable image.',
  },
  {
    title: 'Pulse Archive',
    discipline: 'Web Experience',
    client: 'Wellcome Collection',
    year: 2022,
    style: 'flow',
    palette: ['#0b0507', '#ff4f6d', '#ffd1da', '#3d0f1a'],
    aspect: 1.4,
    description:
      'Ten thousand heartbeats donated by visitors, rendered as a single flowing field you can scroll through in time.',
  },
  // IV — Silence
  {
    title: 'White Room',
    discipline: 'Scenography',
    client: 'Berliner Ensemble',
    year: 2025,
    style: 'void',
    palette: ['#0e0e0e', '#ecebe7', '#b9b7b1', '#d7d5cf'],
    aspect: 0.8,
    description:
      'A stage stripped to one wall and one light, designed for a play performed almost entirely in pauses.',
  },
  {
    title: 'Horizon Line',
    discipline: 'Photography',
    client: 'Self-initiated',
    year: 2024,
    style: 'horizon',
    palette: ['#0a0c10', '#9fb4c7', '#e8eef2', '#2e3b48'],
    aspect: 1.7,
    description:
      'The North Sea photographed at the same minute each day for a year. The sea never agreed with itself.',
  },
  {
    title: 'Hush',
    discipline: 'Product Design',
    client: 'Oblique Audio',
    year: 2023,
    style: 'orb',
    palette: ['#0a0908', '#8c8479', '#ded8cc', '#26231f'],
    aspect: 1,
    description:
      'Noise-cancelling headphones designed around the idea of subtraction — no logo, one control, one colour.',
  },
  {
    title: 'Negative Space',
    discipline: 'Typography',
    client: 'Grilli Type',
    year: 2022,
    style: 'letter',
    palette: ['#0c0c0c', '#f0ede6', '#6d6a64', '#1f1f1f'],
    aspect: 0.75,
    description:
      'A display typeface drawn from the counters of other typefaces — letters made from what was left out.',
  },
  {
    title: 'Last Light',
    discipline: 'Short Film',
    client: 'Mubi',
    year: 2022,
    style: 'gradient',
    palette: ['#05060a', '#28324d', '#c7a27a', '#10141f'],
    aspect: 1.6,
    description:
      'Eight minutes, one shot, no dialogue: a village watching the final sunset before the valley is flooded.',
  },
];

export const ROOM_SIZE = projects.length / rooms.length;
