import { defineConfig } from '@playwright/test';

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Run tests in files in parallel */
  fullyParallel: false, // Set to false for Electron tests to avoid conflicts
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/results.xml' }]
  ],
  
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',
    
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Record video on failure */
    video: 'retain-on-failure',
  },

  /* Configure projects for different Electron scenarios */
  projects: [
    {
      name: 'electron',
      testDir: './tests/e2e',
      use: {
        // Electron-specific configuration
        // Note: We'll configure Electron launching in the test setup
      },
    },
  ],

  /* Global setup and teardown */
  globalSetup: './tests/setup/global.setup.ts',
  globalTeardown: './tests/setup/global.teardown.ts',
  
  /* Test timeout */
  timeout: 30 * 1000, // 30 seconds for E2E tests
  
  /* Expect timeout */
  expect: {
    timeout: 5000
  },
  
  /* Output folder for test results */
  outputDir: 'test-results/',
});