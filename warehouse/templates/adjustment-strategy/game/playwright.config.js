// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:8787',
    headless: true,
    viewport: { width: 480, height: 800 },
    actionTimeout: 10000,
  },
  webServer: {
    command: 'npx serve . -l 8787 -s --no-clipboard',
    port: 8787,
    reuseExistingServer: true,
    timeout: 10000,
  },
  reporter: [['json', { outputFile: 'test-results.json' }]],
});
