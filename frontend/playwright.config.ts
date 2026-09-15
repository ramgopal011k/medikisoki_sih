import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 3600000,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list'], ['json', { outputFile: 'reports/test-results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'mobile-chrome',
      use: {
        ...devices['iPhone 14'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14 Safari'],
      },
    },
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro 11'],
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: '../backend',
      port: 3001,
      reuseExistingServer: true,
      timeout: 60000,
    },
    {
      command: 'npm run dev',
      cwd: '.',
      port: 5173,
      reuseExistingServer: true,
      timeout: 60000,
    },
  ],
});
