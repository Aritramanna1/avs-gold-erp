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

  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });

  await page.goto("/");
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 30_000 });

  // Seed the pilot dataset once. __mtjSeed is installed asynchronously (a
  // dynamic import() inside a useEffect in src/routes/__root.tsx, DEV builds
  // only) which races against the check below — wait for it to land instead
  // of checking once immediately after login. If it's genuinely absent (e.g.
  // a production build target), skip seeding rather than fail the whole run;
  // tests that depend on seeded records will fail individually with a clear
  // error instead.
  await page
    .waitForFunction(() => typeof (window as any).__mtjSeed === "function", { timeout: 15_000 })
    .catch(() => {});
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
