/** Portfolio content. Each entry is rendered as a poster, screen or monolith inside the building. */
export const projects = [
  {
    id: 'casa-umbra', index: '01', title: 'Casa Umbra', discipline: 'Residential', year: '2024', location: 'Oaxaca, MX',
    motif: 'arch', palette: ['#e9e2d6', '#1c1a17', '#c4411f'],
    lede: 'A house organised around a single shadow that moves through it over the course of a day.',
    body: [
      'Casa Umbra is built from rammed earth and board-marked concrete. Instead of rooms, the plan is a sequence of thresholds, each calibrated to the sun at a specific hour.',
      'The central void acts as a sundial: the family tells time by which wall is in darkness.',
    ],
    facts: { Area: '310 m²', Material: 'Rammed earth, concrete', Duration: '26 months', Role: 'Lead architect' },
    credits: 'With Taller Oaxaca · Structural engineering by Ruiz & Partners · Photography by the studio',
  },
  {
    id: 'quiet-engine', index: '02', title: 'The Quiet Engine', discipline: 'Installation', year: '2025', location: 'Rotterdam, NL',
    motif: 'circle', palette: ['#1d1c1a', '#efe8dc', '#e8b44a'],
    lede: 'A turbine hall that produces nothing but silence.',
    body: [
      'Twelve suspended discs rotate at the speed of the visitors below them. When the hall is empty, the engine stops.',
      'The piece was commissioned for a decommissioned power station and ran for ninety days.',
    ],
    facts: { Scale: '42 m hall', Medium: 'Steel, sensors, motors', Visitors: '118,000', Role: 'Concept & spatial design' },
    credits: 'Commissioned by Stichting Havenkracht · Sound by Lune Collective',
  },
  {
    id: 'unfinished-stair', index: '03', title: 'Stair of Unfinished Thoughts', discipline: 'Spatial sculpture', year: '2023', location: 'Porto, PT',
    motif: 'stairs', palette: ['#c9c0b2', '#26231f', '#2f4b7c'],
    lede: 'Forty-one steps that climb to a landing that was never built.',
    body: [
      'Cast in a single pour on the riverbank, the stair invites visitors to stop exactly where the architecture does.',
      'It has become a place to sit, argue and watch the Douro — a building made entirely of its approach.',
    ],
    facts: { Height: '9.4 m', Material: 'White concrete', Steps: '41', Role: 'Design & fabrication lead' },
    credits: 'Produced with the city of Porto · Formwork by Atelier Brisa',
  },
  {
    id: 'index-of-shadows', index: '04', title: 'Index of Shadows', discipline: 'Photographic survey', year: '2022', location: 'Chandigarh, IN',
    motif: 'grid', palette: ['#d8d0c3', '#1b1a18', '#8a3b2a'],
    lede: 'Four hundred photographs of the same concrete, taken at the same minute, across one year.',
    body: [
      'The survey catalogues the shadows of the Capitol Complex as a second, softer architecture laid over the first.',
      'Published as a 480-page book and exhibited as a wall of daily prints.',
    ],
    facts: { Images: '412', Format: 'Book & exhibition', Duration: '365 days', Role: 'Photographer & editor' },
    credits: 'Printed by Kettler · Design with Studio Folio',
  },
  {
    id: 'low-orbit', index: '05', title: 'Low Orbit Pavilion', discipline: 'Pavilion', year: '2026', location: 'Tokyo, JP',
    motif: 'slabs', palette: ['#b8b1a6', '#141414', '#e05a2b'],
    lede: 'Five slabs stacked as if they had just stopped falling.',
    body: [
      'The pavilion is an exercise in apparent weightlessness: each slab is cantilevered from a hidden steel core, so the roof seems to hover above its own walls.',
      'At night, a single line of light traces the gap between each slab.',
    ],
    facts: { Area: '140 m²', Structure: 'Post-tensioned concrete', Span: '11 m cantilever', Role: 'Architect' },
    credits: 'Engineering by Kuroda Structures · Lighting by Hikari Lab',
  },
  {
    id: 'soft-brutalism', index: '06', title: 'Soft Brutalism', discipline: 'Digital identity', year: '2025', location: 'Berlin, DE',
    motif: 'grid', palette: ['#141312', '#efe8dc', '#7fb0a0'],
    lede: 'An identity system for a housing cooperative, built from the proportions of its own facade.',
    body: [
      'Every typographic grid, icon and web layout is derived from the 1972 panel system of the building it represents.',
      'The website renders the facade live, with each window lit by a resident who has opted in.',
    ],
    facts: { Scope: 'Identity, web, signage', Stack: 'WebGL, Astro', Residents: '612', Role: 'Creative direction' },
    credits: 'For a Berlin housing cooperative · Development with Nordlicht',
  },
  {
    id: 'ninety-degrees', index: '07', title: 'Ninety Degrees', discipline: 'Film & projection', year: '2024', location: 'Venice, IT',
    motif: 'arch', palette: ['#0f0f10', '#f2ece2', '#d4532e'],
    lede: 'A room that rotates, filmed by a camera that does not.',
    body: [
      'A twenty-minute single-shot film in which a furnished room slowly turns through ninety degrees around a seated performer.',
      'Shown as a floor-to-ceiling projection, installed on its side.',
    ],
    facts: { Runtime: '21 min', Format: '4K projection', Venue: 'Arsenale', Role: 'Director & set designer' },
    credits: 'Cinematography: M. Laurent · Rotating set by Scenografia Nord',
  },
  {
    id: 'weather-room', index: '08', title: 'Weather Room', discipline: 'Immersive environment', year: '2026', location: 'Reykjavík, IS',
    motif: 'circle', palette: ['#101314', '#e9eef0', '#9cc3d5'],
    lede: 'An interior with its own climate, controlled by the sky outside.',
    body: [
      'Live meteorological data drives fog, light temperature and air movement inside a sealed concrete chamber.',
      'On clear days the room is almost unbearably bright. On storm days, visitors queue for hours.',
    ],
    facts: { Volume: '1,800 m³', Systems: 'Fog, light, air', Data: 'Live, 1 Hz', Role: 'Concept & experience design' },
    credits: 'Environmental engineering by Vindur · Data partnership with a national weather service',
  },
];
