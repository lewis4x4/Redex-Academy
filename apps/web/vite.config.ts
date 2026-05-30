import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// F4: offline PWA. Workbox (via vite-plugin-pwa generateSW) precaches the app
// shell + hashed assets, and runtime-caches the catalog (SWR) and API (network-
// first). VIDEO is never precached — explicit per-video opt-in (offline/field-pack.ts).
// Dexie holds the durable offline queue; the idempotent /sync reconciles on reconnect.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // explicit update prompt (not silent auto)
      injectRegister: null, // we register manually in src/registerSW.ts
      manifest: false, // use the committed public/manifest.webmanifest (F1)
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'], // precache the app shell
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Published catalog reads — stale-while-revalidate (fast + fresh-ish).
            urlPattern: ({ url }) =>
              url.pathname.includes('/rest/v1/') && url.search.includes('status=eq.published'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'redex-catalog' },
          },
          {
            // Other API calls — network-first (server authority; offline falls back).
            urlPattern: ({ url }) =>
              url.pathname.includes('/rest/v1/') || url.pathname.includes('/functions/v1/'),
            handler: 'NetworkFirst',
            options: { cacheName: 'redex-api', networkTimeoutSeconds: 5 },
          },
          {
            // Field-pack media (images/captions) — cache-first. NOT video.
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: { cacheName: 'redex-media', expiration: { maxEntries: 200 } },
          },
        ],
      },
    }),
  ],
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
