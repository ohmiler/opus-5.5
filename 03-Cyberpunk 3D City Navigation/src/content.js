// All portfolio copy lives here. Edit freely — the city is built from this data.
// `anchor` places the section's landmark: side -1 = left of the avenue, 1 = right, 0 = end of street.

export const PROFILE = {
  name: 'Nova Kitamura',
  role: 'Creative Technologist',
  email: 'hello@example.com',
};

export const SECTIONS = [
  {
    id: 'about',
    index: '01',
    title: 'About',
    kicker: 'Identity record',
    color: '#19f0ff',
    anchor: { side: -1, z: -8, height: 62 },
    blocks: [
      {
        type: 'lead',
        text: 'I build interfaces that feel like places — interactive systems where motion, sound and type carry the story.',
      },
      {
        type: 'text',
        text: 'Ten years between design studios and engineering teams taught me that craft lives in the last 5%: the easing curve, the loading state, the frame you never drop. I prototype in code, ship in code, and obsess over how things feel under a thumb or a trackpad.',
      },
      {
        type: 'stats',
        items: [
          ['10+', 'Years shipping'],
          ['60', 'FPS budget'],
          ['38', 'Launches'],
        ],
      },
      { type: 'tags', items: ['WebGL / Three.js', 'GLSL', 'TypeScript', 'Motion design', 'Creative direction', 'Web Audio'] },
    ],
  },
  {
    id: 'projects',
    index: '02',
    title: 'Projects',
    kicker: 'Selected work',
    color: '#ff2bd6',
    anchor: { side: 1, z: -44, height: 74 },
    blocks: [
      {
        type: 'projects',
        items: [
          {
            title: 'Tidal Archive',
            year: '2026',
            desc: 'A real-time ocean data explorer rendering 40M buoy readings as a navigable volumetric sea.',
            tags: 'WebGPU · Data viz · Sound',
            href: '#',
          },
          {
            title: 'Halcyon OS',
            year: '2025',
            desc: 'Spatial launcher concept for a mixed-reality headset. Gesture-first, with haptic-synced micro-interactions.',
            tags: 'Prototyping · XR · Motion',
            href: '#',
          },
          {
            title: 'Paper Weather',
            year: '2024',
            desc: 'Generative forecast posters printed daily for a Tokyo gallery — 365 unique editions.',
            tags: 'Generative · Print · Node',
            href: '#',
          },
          {
            title: 'Signal / Noise',
            year: '2023',
            desc: 'Award-winning launch site for an audio hardware brand; scroll-scrubbed WebGL product film.',
            tags: 'Three.js · Art direction',
            href: '#',
          },
        ],
      },
    ],
  },
  {
    id: 'experience',
    index: '03',
    title: 'Experience',
    kicker: 'Service log',
    color: '#ffb13b',
    anchor: { side: -1, z: -80, height: 56 },
    blocks: [
      {
        type: 'timeline',
        items: [
          {
            period: '2023 — NOW',
            role: 'Lead Creative Technologist',
            org: 'Studio Kairo, Tokyo',
            desc: 'Lead a six-person team building interactive launches and installations for music, auto and fashion clients.',
          },
          {
            period: '2020 — 2023',
            role: 'Senior Frontend Engineer',
            org: 'Northwind Labs',
            desc: 'Built the rendering layer of a collaborative 3D design tool. Cut first-frame time by 62%.',
          },
          {
            period: '2017 — 2020',
            role: 'Interaction Designer',
            org: 'Field & Form',
            desc: 'Designed and coded motion systems for editorial and museum experiences.',
          },
          {
            period: '2015 — 2017',
            role: 'Developer',
            org: 'Freelance',
            desc: 'Microsites, generative identities and too many late nights with shaders.',
          },
        ],
      },
    ],
  },
  {
    id: 'contact',
    index: '04',
    title: 'Contact',
    kicker: 'Open channel',
    color: '#8f7bff',
    anchor: { side: 0, z: -134, height: 88 },
    blocks: [
      { type: 'status', text: 'Available for select projects — Q1 2027' },
      {
        type: 'lead',
        text: 'Have a world you want people to walk through? Send a signal.',
      },
      {
        type: 'links',
        items: [
          ['Email', 'hello@example.com', 'mailto:hello@example.com'],
          ['GitHub', '@novakitamura', '#'],
          ['LinkedIn', 'in/novakitamura', '#'],
          ['Read.cv', 'nova', '#'],
        ],
      },
    ],
  },
];
