import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";

const root = path.resolve(import.meta.dirname, "../..");
for (const fileName of ["qa/config/qa.env", ".env.e2e", ".env.test.local", ".env"]) {
  const p = path.join(root, fileName);
  if (fs.existsSync(p)) process.loadEnvFile(p);
}

const PORT = Number(process.env.PORT) || 3000;
// qa.env must override system-level E2E_BASE_URL (e.g. production URLs in user env)
const BASE_URL = process.env.QA_BASE_URL || process.env.E2E_BASE_URL || `http://localhost:${PORT}`;
process.env.E2E_BASE_URL = BASE_URL;
const CI = !!process.env.CI;
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(BASE_URL);
const authStatePath = path.resolve(root, "e2e/.auth/state.json");

export default defineConfig({
  testDir: path.join(root, "e2e/tests"),
  outputDir: path.join(root, "qa/reports-output/playwright-artifacts"),
  globalSetup:
    process.env.PLAYWRIGHT_UNAUTH_ONLY === "1" ? undefined : path.join(root, "e2e/global-setup.ts"),
  fullyParallel: false,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  snapshotPathTemplate: "{testDir}/../visual/baselines/{projectName}/{testFilePath}/{arg}{ext}",
  updateSnapshots: process.env.QA_UPDATE_SNAPSHOTS === "1" ? "all" : "none",
  reporter: [
    ["list"],
    ["html", { outputFolder: "qa/reports-output/playwright-report", open: "never" }],
    ["json", { outputFile: "qa/reports-output/playwright-results.json" }],
    ["junit", { outputFile: "qa/reports-output/junit-playwright.xml" }],
  ],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    storageState: process.env.PLAYWRIGHT_UNAUTH_ONLY === "1" ? undefined : authStatePath,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-375",
      use: { browserName: "chromium", viewport: { width: 375, height: 812 }, isMobile: true },
    },
    {
      name: "mobile-390",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true },
    },
    {
      name: "mobile-430",
      use: { browserName: "chromium", viewport: { width: 430, height: 932 }, isMobile: true },
    },
    {
      name: "tablet-768",
      use: { browserName: "chromium", viewport: { width: 768, height: 1024 }, isMobile: true },
    },
    {
      name: "desktop-1024",
      use: { browserName: "chromium", viewport: { width: 1024, height: 768 } },
    },
    {
      name: "desktop-1440",
      use: { browserName: "chromium", viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: IS_LOCAL
    ? {
        command: "npm run preview:shop",
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 120_000,
        env: { VITE_DEFAULT_DEPLOYMENT_MODE: "online" },
      }
    : undefined,
});
