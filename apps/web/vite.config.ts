import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// App shell only at F1. The offline PWA (Workbox precache + Dexie + idempotent
// /sync) is wired in F4 — do not add a service worker here.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  preview: { port: 4173 },
  build: { outDir: 'dist', sourcemap: true },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
