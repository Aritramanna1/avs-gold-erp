import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

// Load e2e-only environment variables from .env.e2e (gitignored — never
// committed). Never falls back to hardcoded credentials: authentication
// tests read process.env.E2E_EMAIL / E2E_PASSWORD directly and fail with a
// clear error if they're unset (see e2e/fixtures/base.ts).
//
// NOTE: this file runs as ESM (package.json has "type": "module"), so
// `__dirname` is not defined here — use import.meta.dirname instead.
const envFilePath = path.resolve(import.meta.dirname, ".env.e2e");
if (fs.existsSync(envFilePath)) {
  process.loadEnvFile(envFilePath);
}
// If .env.e2e doesn't exist, that's fine for unauthenticated-only runs —
// authenticated fixtures raise their own explicit error when actually used.

const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
const CI = !!process.env.CI;
// Only manage a local dev server when targeting localhost. When E2E_BASE_URL
// points at a real deployed host (e.g. a production/staging URL), Playwright
// must talk to that server directly and never spawn/assume a local one.
const IS_LOCAL_TARGET = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(BASE_URL);

/**
 * MTJ ERP — Playwright E2E configuration.
 *
 * Authenticated suites require E2E_EMAIL / E2E_PASSWORD (loaded from
 * `.env.e2e`, gitignored) to point at a dedicated test account — ideally on a
 * non-production Supabase project, never the live demo/production database.
 * Tests that need a session fail immediately with a clear error when these
 * are not set, rather than fabricating credentials or skipping silently.
 */
const authStatePath = path.resolve(import.meta.dirname, "e2e/.auth/state.json");

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/test-results",
  // Logs in once and seeds the pilot dataset once (see e2e/global-setup.ts)
  // instead of every test repeating both.
  globalSetup: "./e2e/global-setup.ts",
  // Sequential, single worker: every authenticated test reuses one seeded
  // dataset (see e2e/fixtures/base.ts's seededPage) rather than fighting
  // over shared master data or re-logging-in per test.
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  workers: 1,
  // Generous: Vite dev mode cold-compiles each route's module on first full
  // navigation, which is slower than a production build — production builds
  // serve pre-bundled assets and won't need this much headroom.
  timeout: 60_000,
  expect: { timeout: 20_000 },

  reporter: [
    ["html", { outputFolder: "e2e/report", open: "never" }],
    ["list"],
    ...(CI ? ([["github"]] as const) : []),
    ["json", { outputFile: "e2e/report/results.json" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 25_000,
    navigationTimeout: 30_000,
    // The authenticated + seeded session from global-setup.ts (written before
    // any test worker starts, so the path is always valid by the time this
    // is read). Tests that need a signed-out view (login/logout/forgot-
    // password specs) clear it via test.use({ storageState: { cookies: [],
    // origins: [] } }).
    storageState: authStatePath,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
      testMatch: /.*\.responsive\.spec\.ts/,
    },
  ],

  webServer: IS_LOCAL_TARGET
    ? {
        command: "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 120_000,
        // The suite exercises the cloud/Supabase-auth product path. App default
        // is now Offline (V1 is offline-first), so opt this build back in.
        env: { VITE_DEFAULT_DEPLOYMENT_MODE: "online" },
      }
    : undefined,
});
