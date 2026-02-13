import path from 'node:path'

import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  fullyParallel: false,
  workers: 1,

  globalSetup: path.join(__dirname, 'global-setup.ts'),
  globalTeardown: path.join(__dirname, 'global-teardown.ts'),

  timeout: 60_000,

  reporter: [
    ['list'],
    [
      'html',
      {
        open: 'never',
        outputFolder: path.join(__dirname, 'playwright-report'),
      },
    ],
  ],

  outputDir: path.join(__dirname, 'test-results'),

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    video: 'off',
    actionTimeout: 30_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
})
