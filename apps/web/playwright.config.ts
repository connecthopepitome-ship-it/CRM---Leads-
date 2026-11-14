import { defineConfig, devices } from '@playwright/test';

/** E2E: API dev server (in-memory DB, fake Google) + Vite preview of the built PWA. */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    { command: 'corepack pnpm --filter @ss/api exec tsx src/server.ts', url: 'http://localhost:8787/api/v1/health', reuseExistingServer: true, timeout: 60_000, env: { DEV_ADMIN_PASSWORD: 'Temp-Passw0rd-1' } },
    { command: 'corepack pnpm exec vite preview --port 4173 --strictPort', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 60_000 },
  ],
});
