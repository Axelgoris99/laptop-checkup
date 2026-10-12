import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// The full checkup plus one page per standalone test (for search engines).
const PAGES = ['keyboard-test', 'dead-pixel-test', 'webcam-test']

export default defineConfig({
  plugins: [react()],
  // Relative paths: works on GitHub Pages (/laptop-checkup/) and inside Tauri.
  base: './',
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        ...Object.fromEntries(PAGES.map((p) => [p, resolve(import.meta.dirname, p, 'index.html')])),
      },
    },
  },
})
