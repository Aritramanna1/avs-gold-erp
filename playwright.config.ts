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
const envFiles = [".env", ".env.test.local", ".env.e2e"] as const;
for (const fileName of envFiles) {
  const envFilePath = path.resolve(import.meta.dirname, fileName);
  if (fs.existsSync(envFilePath)) {
    process.loadEnvFile(envFilePath);
  }
}
if (process.env.E2E_LIVE_DATA === "1") {
  process.env.E2E_LIVE_DATA = "true";
}
// Load the repo's shipped .env files first so CI/local E2E credentials and
// feature flags are available without requiring a separate manual export.

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
const UNAUTH_ONLY = process.env.PLAYWRIGHT_UNAUTH_ONLY === "1";

const PRODUCTION_SUPABASE_REF = "dqgrrafuoxaorvyrcuuh";

function resolveConfiguredSupabaseRef(): string | null {
  for (const fileName of [".env.e2e", ".env.local", ".env"]) {
    const p = path.resolve(import.meta.dirname, fileName);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, "utf8");
    const urlMatch = text.match(/(?:VITE_SUPABASE_URL|QA_SUPABASE_URL)=(.+)/);
    if (urlMatch) {
      const host = urlMatch[1].trim().replace(/^["']|["']$/g, "");
      const ref = host.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
      if (ref) return ref;
    }
    const idMatch = text.match(/VITE_SUPABASE_PROJECT_ID=(.+)/);
    if (idMatch) return idMatch[1].trim().replace(/^["']|["']$/g, "");
  }
  return process.env.VITE_SUPABASE_PROJECT_ID ?? null;
}

const configuredRef = resolveConfiguredSupabaseRef();
if (
  configuredRef === PRODUCTION_SUPABASE_REF &&
  process.env.ALLOW_PROD_E2E === "0"
) {
  throw new Error(
    `[playwright] BLOCKED: E2E against production Supabase (${PRODUCTION_SUPABASE_REF}) is disabled. ` +
      `Set ALLOW_PROD_E2E=1 only for explicit owner-approved parity runs.`,
  );
}

export default defineConfig({
  testDir: "./e2e/tests",
  outputDir: "./e2e/test-results",
  // Logs in once and seeds the pilot dataset once (see e2e/global-setup.ts)
  // instead of every test repeating both.
  globalSetup: UNAUTH_ONLY ? undefined : "./e2e/global-setup.ts",
  // Sequential, single worker: every authenticated test reuses one seeded
  // dataset (see e2e/fixtures/base.ts's seededPage) rather than fighting
  // over shared master data or re-logging-in per test.
  // NEVER run multiple Playwright processes against this project in parallel —
  // they share e2e/.auth/state.json (see e2e/auth-setup-lock.ts). Use
  // _reconstruction/run-parity-serial.mjs for the full parity matrix.
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
    storageState: UNAUTH_ONLY ? undefined : authStatePath,
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
        command: "npx vite --port 3000",
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 120_000,
        env: {
          VITE_DEFAULT_DEPLOYMENT_MODE: "online",
          VITE_ENABLE_DEV_SUPABASE: "1",
        },
      }
    : undefined,
});
