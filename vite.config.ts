import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // Relative paths: works on GitHub Pages (/laptop-checkup/) and inside Tauri.
  base: './',
  clearScreen: false,
  server: { port: 5173, strictPort: true },
})
