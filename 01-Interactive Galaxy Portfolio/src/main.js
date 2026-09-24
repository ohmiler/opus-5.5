import '@fontsource/instrument-serif/400.css'
import '@fontsource/instrument-serif/400-italic.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource-variable/inter-tight/wght.css'
import './styles/main.css'

import { App } from './core/App.js'

const $ = (s) => document.querySelector(s)

const app = new App({
  canvas: $('canvas.webgl'),
  loader: $('.loader'),
  hud: $('[data-hud]'),
  intro: $('[data-intro]'),
  outro: $('[data-outro]'),
  labels: $('[data-labels]'),
  panel: $('[data-panel]'),
  cursor: $('[data-cursor-root]'),
  fallback: $('[data-fallback]'),
})

app.start()

if (import.meta.env.DEV) {
  // Debug handles for the console.
  window.__app = app
  import('gsap').then(({ default: gsap }) => (window.__gsap = gsap))
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose())
}
