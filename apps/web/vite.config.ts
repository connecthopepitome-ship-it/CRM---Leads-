import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';
// relative import so Vite bundles it into the config (FR-001): CLIENT_ID=<id> pnpm build validates clients/<id>/config.json
import { DEV_CLIENT, loadClientConfig, manifestFor } from '../../packages/config/src/index';

const clientId = process.env.CLIENT_ID;
const clientFile = clientId ? new URL(`../../clients/${clientId}/config.json`, import.meta.url) : null;
const client = clientFile ? loadClientConfig(JSON.parse(readFileSync(clientFile, 'utf8')), `clients/${clientId}/config.json`) : DEV_CLIENT;

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['icon.svg'],
      manifest: manifestFor(client),
      workbox: {
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/v1/masters/'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'lookups' },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://localhost:8787' } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'jsdom', exclude: ['e2e/**', 'node_modules/**'] },
});
