import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { requireEnv } from "./data/test-data";

/**
 * Runs once before the whole suite. Logs in via the real UI, seeds the
 * pilot dataset (window.__mtjSeed — DEV-mode only, see src/lib/test-seed.ts),
 * and saves the resulting session + localStorage to e2e/.auth/state.json.
 * Every test then starts from this state via `use.storageState`, instead of
 * re-logging-in and re-seeding per test.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const email = requireEnv("E2E_EMAIL");
  const password = requireEnv("E2E_PASSWORD");

  const authDir = path.resolve(import.meta.dirname, ".auth");
  fs.mkdirSync(authDir, { recursive: true });
  const statePath = path.join(authDir, "state.json");

  console.log(`[global-setup] Launching browser to authenticate user: ${email} against ${baseURL}`);
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  try {
    console.log("[global-setup] Navigating to /");
    await page.goto("/", { timeout: 45_000 });
    console.log("[global-setup] Filling login details");
    await page.getByTestId("auth-email").fill(email, { timeout: 15_000 });
    await page.getByTestId("auth-password").fill(password, { timeout: 15_000 });
    console.log("[global-setup] Clicking submit");
    await page.getByTestId("auth-submit").click({ timeout: 15_000 });

    // Wait for the login form to hide, indicating successful authentication.
    // If it fails (e.g. rate limit, invalid credentials, offline), catch and fallback
    console.log("[global-setup] Waiting for auth form to hide");
    await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 45_000 });
    console.log("[global-setup] Authentication successful");
  } catch (err) {
    const pageUrl = page.url();
    const bodyText = await page.locator("body").innerText().catch(() => "N/A");
    await browser.close();
    // No mock-session fallback: a login failure here means the whole suite
    // would otherwise run against a fabricated session, giving false
    // confidence that every downstream test against real Supabase auth/RLS/
    // writes actually passed. Fail loudly instead so a broken test account
    // or a real login regression is never silently masked.
    throw new Error(
      `[global-setup] Real login failed for ${email} against ${baseURL}. Page URL: ${pageUrl}. ` +
        `Body preview: ${bodyText.slice(0, 300)}. Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.log("[global-setup] Waiting for window.__mtjSeed to be loaded");
  await page
    .waitForFunction(() => typeof (window as any).__mtjSeed === "function", { timeout: 45_000 })
    .catch(() => {
      console.warn("[global-setup] Timeout waiting for window.__mtjSeed");
    });
  const seedResult = await page.evaluate(() => {
    const w = window as unknown as { __mtjSeed?: () => Record<string, unknown> };
    return typeof w.__mtjSeed === "function" ? w.__mtjSeed() : null;
  });
  if (seedResult) {
    fs.writeFileSync(path.join(authDir, "seed.json"), JSON.stringify(seedResult, null, 2));
  } else {
    console.warn(
      "[global-setup] window.__mtjSeed() not found — skipping data seed. " +
        "Tests that depend on pre-seeded records will fail individually. " +
        "__mtjSeed is only installed in DEV builds (import.meta.env.DEV).",
    );
  }

  await page.context().storageState({ path: statePath });
  await browser.close();
}
