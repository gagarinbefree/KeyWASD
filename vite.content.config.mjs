import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    lib: { entry: 'src/remote.ts', name: 'KeyWest', formats: ['iife'], fileName: () => 'controller.js' }
  }
})
