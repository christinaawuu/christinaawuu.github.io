import { defineConfig } from 'vite';

// VITE_BASE is set by the deploy workflow ("/" for username.github.io repos,
// "/<repo>/" otherwise), so the same code works locally and on GitHub Pages.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
});
