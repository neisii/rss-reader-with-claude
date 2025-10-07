import { defineConfig, devices } from "@playwright/test";
import path from "path";

/**
 * Playwright configuration for Chrome Extension testing
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: "./tests",

  /* Run tests in files in parallel */
  fullyParallel: false, // Extension tests should run sequentially

  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Single worker for extension tests to avoid conflicts */
  workers: 1,

  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [["html"], ["list"], ...(process.env.CI ? [["github"]] : [])],

  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",

    /* Screenshot on failure */
    screenshot: "only-on-failure",

    /* Video recording on failure */
    video: "retain-on-failure",

    /* Ignore HTTPS errors for RSS feeds */
    ignoreHTTPSErrors: true,

    /* Extension tests must run in headed mode */
    headless: false,

    /* Viewport size */
    viewport: { width: 1280, height: 720 },
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chrome-extension",
      use: {
        ...devices["Desktop Chrome"],
        channel: "chrome", // Use stable Chrome
        executablePath:
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        launchOptions: {
          args: [
            // Load the extension - use absolute path to ensure it works
            `--disable-extensions-except=${path.resolve(process.cwd())}`,
            `--load-extension=${path.resolve(process.cwd())}`,

            // Enable extension loading in automation
            "--enable-automation",
            "--enable-extensions",

            // Security flags for testing
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",

            // macOS specific security bypass flags
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--disable-features=HttpsFirstBalancedModeAutoEnable",
            "--disable-blink-features=AutomationControlled",
            "--disable-notifications",
            "--disable-gpu",
            "--disable-ipc-flooding-protection",
            "--allow-running-insecure-content",
            "--disable-component-extensions-with-background-pages",

            // Chrome automation detection bypass
            "--test-type",
            "--no-default-browser-check",
            "--no-first-run",
            "--disable-default-apps",
            "--disable-popup-blocking",
            "--disable-translate",
            "--disable-background-networking",

            // Extension-specific flags
            "--disable-background-timer-throttling",
            "--disable-backgrounding-occluded-windows",
            "--disable-renderer-backgrounding",

            // Debugging flags (optional)
            // '--enable-logging',
            // '--v=1'
          ],
          // Keep browser open for debugging
          slowMo: process.env.DEBUG ? 1000 : 0,
        },
      },
    },
  ],

  /* Global setup and teardown */
  // globalSetup: require.resolve('./tests/global-setup'),
  // globalTeardown: require.resolve('./tests/global-teardown'),

  /* Test timeout */
  timeout: 30000,
  expect: {
    timeout: 10000,
  },

  /* Output folder for test results */
  outputDir: "test-results/",

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  // testOutputDir: './test-results/',
});
