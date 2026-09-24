/**
 * Portfolio content. Every planet in the galaxy is generated from an entry here.
 *
 * `world` controls how the planet is rendered:
 *   type     – surface shader variant: 'gas' | 'magma' | 'ocean' | 'pearl' | 'ice'
 *   radius   – planet radius in world units
 *   orbit    – distance from the galactic core along the spiral arm
 *   lift     – vertical offset from the galactic plane
 *   palette  – three surface colours (dark → mid → light)
 *   accent   – atmosphere / particle / UI accent colour
 */
export const owner = {
  name: 'Iris Vale',
  role: 'Creative technologist',
  location: 'Lisbon — remote',
  email: 'hello@irisvale.studio',
  links: [
    { label: 'GitHub', href: 'https://github.com/' },
    { label: 'Read.cv', href: 'https://read.cv/' },
    { label: 'LinkedIn', href: 'https://www.linkedin.com/' },
  ],
}

export const projects = [
  {
    id: 'aurelia',
    code: 'PX—01',
    name: 'Aurelia',
    tagline: 'A generative identity that listens.',
    classification: 'Banded gas giant',
    year: '2025',
    client: 'Aurelia Sound Festival',
    role: 'Creative developer, tech lead',
    duration: '14 weeks',
    stack: ['WebGL', 'GLSL', 'TouchDesigner', 'Node'],
    description:
      'A living brand system for a three-day electronic music festival. Every poster, stage visual and ticket was drawn by the same audio-reactive engine, so the identity literally changed with the line-up.',
    highlights: [
      '41 stage shows rendered live from one shader graph',
      '2.3M unique ticket artworks generated',
      'Cannes Lions — Digital Craft shortlist',
    ],
    link: 'https://example.com/aurelia',
    world: {
      type: 'gas',
      radius: 2.6,
      orbit: 15,
      lift: 1.2,
      tilt: 0.42,
      spin: 0.05,
      ring: true,
      palette: ['#3a1d0e', '#c9793a', '#f3dcb2'],
      accent: '#ffb46b',
    },
  },
  {
    id: 'vanta',
    code: 'PX—02',
    name: 'Vanta',
    tagline: 'Seeing risk before it erupts.',
    classification: 'Volcanic dwarf',
    year: '2024',
    client: 'Northgate Capital',
    role: 'Lead engineer, data visualisation',
    duration: '9 months',
    stack: ['Three.js', 'WebGPU', 'Rust / WASM', 'WebSockets'],
    description:
      'A real-time risk surface for a derivatives desk. Four million positions collapse into a single terrain where stress fractures glow before they become losses.',
    highlights: [
      '60 fps with 4M live data points',
      'Mean time-to-insight cut from minutes to seconds',
      'Adopted across three trading floors',
    ],
    link: 'https://example.com/vanta',
    world: {
      type: 'magma',
      radius: 1.55,
      orbit: 22,
      lift: -0.8,
      tilt: 0.2,
      spin: 0.03,
      ring: false,
      palette: ['#07070a', '#1c1614', '#3b2a22'],
      accent: '#ff5a1f',
    },
  },
  {
    id: 'tidewell',
    code: 'PX—03',
    name: 'Tidewell',
    tagline: 'The ocean, told as a story.',
    classification: 'Ocean world',
    year: '2024',
    client: 'Blue Margin Foundation',
    role: 'Interactive director, developer',
    duration: '5 months',
    stack: ['Mapbox GL', 'D3', 'Three.js', 'Python'],
    description:
      'A scroll-driven documentary about warming currents, built on forty years of satellite data. Readers dive from global circulation down to a single reef in one continuous shot.',
    highlights: [
      '1.1M readers in the first month',
      'Featured by The Guardian and Le Monde',
      'Webby Award — Best Data Visualisation',
    ],
    link: 'https://example.com/tidewell',
    world: {
      type: 'ocean',
      radius: 2.1,
      orbit: 29,
      lift: 1.6,
      tilt: 0.36,
      spin: 0.04,
      ring: false,
      palette: ['#031622', '#0d5566', '#9fd8cf'],
      accent: '#5fe3d2',
    },
  },
  {
    id: 'halcyon',
    code: 'PX—04',
    name: 'Halcyon',
    tagline: 'Jewellery you can turn in your hand.',
    classification: 'Iridescent pearl',
    year: '2023',
    client: 'Maison Halcyon',
    role: 'Creative developer',
    duration: '4 months',
    stack: ['React Three Fiber', 'PBR', 'Blender', 'Shopify'],
    description:
      'A real-time configurator for a Parisian jewellery house. Pearls, metals and stones are rendered physically in the browser, down to the thin-film shimmer of nacre.',
    highlights: [
      '+38% conversion on configured pieces',
      'Sub-2s first render on mid-range phones',
      'FWA — Site of the Day',
    ],
    link: 'https://example.com/halcyon',
    world: {
      type: 'pearl',
      radius: 1.75,
      orbit: 36,
      lift: -1.4,
      tilt: 0.1,
      spin: 0.06,
      ring: false,
      palette: ['#2a2536', '#bdb3cf', '#fff6ee'],
      accent: '#d8b8ff',
    },
  },
  {
    id: 'frostline',
    code: 'PX—05',
    name: 'Frostline',
    tagline: 'A century of film, searchable by feeling.',
    classification: 'Crystalline ice world',
    year: '2023',
    client: 'National Film Archive',
    role: 'Design engineer',
    duration: '7 months',
    stack: ['Svelte', 'WebGL', 'Elasticsearch', 'CLIP embeddings'],
    description:
      'An archive explorer that arranges 120,000 films by mood, colour and motion instead of title. Researchers wander a frozen constellation of stills and thaw the ones they want.',
    highlights: [
      '120k films embedded and browsable',
      'Research requests up 4× year on year',
      'Open-sourced as the Frostline toolkit',
    ],
    link: 'https://example.com/frostline',
    world: {
      type: 'ice',
      radius: 1.95,
      orbit: 43,
      lift: 0.6,
      tilt: 0.55,
      spin: 0.025,
      ring: false,
      palette: ['#0b1a2c', '#7fb2d6', '#eef8ff'],
      accent: '#9fd4ff',
    },
  },
]
