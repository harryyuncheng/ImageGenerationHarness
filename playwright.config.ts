import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @harness/server dev',
      url: 'http://127.0.0.1:4173/api/health',
      reuseExistingServer: !process.env['CI'],
    },
    {
      command: 'pnpm --filter @harness/web dev',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env['CI'],
    },
  ],
});
