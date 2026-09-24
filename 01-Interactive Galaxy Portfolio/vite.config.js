import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: { port: 5173, host: true },
  build: {
    target: 'es2022',
    // three.js is the bulk of the bundle and is cached separately by the browser anyway.
    chunkSizeWarningLimit: 800,
  },
})
