import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~600 kB minified; keep it in its own long-cached chunk
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        advancedChunks: { groups: [{ name: 'three', test: /node_modules[\/]three/ }] },
      },
    },
  },
});
