import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false, // Served from public/manifest.webmanifest
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff2,wasm}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/storage\.googleapis\.com\/tfjs-models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'tfjs-models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^\/models\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'local-models-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^\/ping\.json/i,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
});
