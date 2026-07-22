import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * MTJ ERP — Onboarding Playwright configuration.
 *
 * A SEPARATE config from playwright.config.ts, on its own dev-server port,
 * because the main suite's webServer forces
 * VITE_DEFAULT_DEPLOYMENT_MODE=online so every other test can skip the Setup
 * Wizard and go straight to a Supabase login. That default makes the Setup
 * Wizard itself permanently unreachable in that build — deployment-mode.ts's
 * getDeploymentMode() falls back straight to "online" before the wizard can
 * ever render.
 *
 * This config instead sets VITE_DEPLOYMENT_MODES_ENABLED=true and leaves
 * VITE_DEFAULT_DEPLOYMENT_MODE unset, so a fresh (no persisted deployment_mode)
 * profile genuinely lands on the wizard — real Setup Wizard, real license
 * activation against the live licensing endpoint, real Sign Up. No auth
 * mocking, no license mocking, no globalSetup pre-auth: every test in this
 * project starts from a wiped local IndexedDB/localStorage (see
 * e2e/fixtures/onboarding.ts) and drives the actual first-run flow.
 */
const PORT = 3010;
const BASE_URL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "./e2e/onboarding",
  outputDir: "./e2e/onboarding-results",
  fullyParallel: false,
  forbidOnly: CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },

  reporter: [
    ["html", { outputFolder: "e2e/onboarding-report", open: "never" }],
    ["list"],
    ["json", { outputFile: "e2e/onboarding-report/results.json" }],
  ],

  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 25_000,
    navigationTimeout: 30_000,
    // No storageState default — every onboarding test starts genuinely
    // signed out with no persisted deployment mode.
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run dev -- --port 3010",
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120_000,
    env: { VITE_DEPLOYMENT_MODES_ENABLED: "true" },
  },
});
