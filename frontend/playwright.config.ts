import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5183',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome', // Use system Chrome
      },
    },
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        channel: 'webkit', // Use system WebKit if available
      },
    },
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5'],
        channel: 'chrome',
      },
    },
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12'],
      },
    },
  ],
  // Don't start webServer - use existing dev server
  expect: {
    toHaveScreenshot: { maxDiffPixels: 100 },
  },
  outputDir: '../docs/qa/failures',
});