import { App } from './App.js';

const app = new App();
app.start();
if (import.meta.env.DEV) window.__app = app; // debugging handle, stripped from production builds

// Free GPU resources before Vite's full-page reload during development.
if (import.meta.hot) import.meta.hot.dispose(() => app.dispose());
