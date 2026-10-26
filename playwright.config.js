import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3471',
  },
  webServer: {
    command: 'npx serve . -l 3471',
    url: 'http://localhost:3471',
    reuseExistingServer: !process.env.CI,
  },
});
