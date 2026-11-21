import { defineConfig, devices } from "@playwright/test";

const port = 4173;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Browser smoke tests.
 *
 * These run against a production build with a deliberately unreachable
 * Supabase URL, so they cover the unauthenticated shell (auth screen, legal
 * pages, navigation) without touching a real project or creating users.
 *
 * The authenticated two-user/Stripe flows remain in docs/qa.md until a
 * disposable Supabase project is available for CI.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: `npm run build && npm run preview -- --host 127.0.0.1 --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      VITE_SUPABASE_URL: "http://127.0.0.1:9",
      VITE_SUPABASE_PUBLISHABLE_KEY: "test-publishable-key",
      VITE_APP_URL: baseURL,
    },
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
