import { chromium, type FullConfig } from "@playwright/test";
import path from "node:path";
import fs from "node:fs";
import { requireEnv } from "./data/test-data";
import {
  acquireAuthSetupLock,
  authStatePath,
  shouldReuseExistingAuthState,
} from "./auth-setup-lock";

/**
 * Runs once before the whole suite. Logs in via the real UI, seeds the
 * pilot dataset (window.__mtjSeed — DEV-mode only, see src/lib/test-seed.ts),
 * and saves the resulting session + localStorage to e2e/.auth/state.json.
 * Every test then starts from this state via `use.storageState`, instead of
 * re-logging-in and re-seeding per test.
 */
export default async function globalSetup(config: FullConfig) {
  const releaseLock = await acquireAuthSetupLock();
  try {
    if (shouldReuseExistingAuthState()) {
      console.log("[global-setup] Reusing existing e2e/.auth/state.json (serial suite lock)");
      return;
    }

    const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
    const email = requireEnv("E2E_EMAIL");
    const password = requireEnv("E2E_PASSWORD");

    const authDir = path.resolve(import.meta.dirname, ".auth");
    fs.mkdirSync(authDir, { recursive: true });
    const statePath = authStatePath();
    const stateTmp = `${statePath}.${process.pid}.tmp`;

    console.log(`[global-setup] Launching browser to authenticate user: ${email} against ${baseURL}`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ baseURL });

    try {
    console.log("[global-setup] Navigating to /login");
    await page.goto("/login", { timeout: 45_000 });
    console.log("[global-setup] Filling login details");
    await page.getByTestId("auth-email").fill(email, { timeout: 15_000 });
    await page.getByTestId("auth-password").fill(password, { timeout: 15_000 });
    console.log("[global-setup] Clicking submit");
    await page.getByTestId("auth-submit").click({ timeout: 15_000 });

    // Wait for the login form to hide, indicating successful authentication.
    // If it fails (e.g. transient network timeout), retry once
    console.log("[global-setup] Waiting for auth form to hide");
    try {
      await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 30_000 });
    } catch {
      console.warn("[global-setup] First login attempt timed out, retrying submit...");
      await page.waitForTimeout(2000);
      if (
        await page
          .getByTestId("auth-form")
          .isVisible()
          .catch(() => false)
      ) {
        await page.getByTestId("auth-email").fill(email, { timeout: 15_000 });
        await page.getByTestId("auth-password").fill(password, { timeout: 15_000 });
        await page.getByTestId("auth-submit").click({ timeout: 15_000 });
        await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 45_000 });
      }
    }
    console.log("[global-setup] Authentication successful");

    // Tenant-role suites may opt into a disposable QA license and setup
    // record. Platform-owner suites do not need this because the control
    // plane intentionally bypasses tenant licensing.
    const qaLicense = process.env.E2E_LICENSE_KEY;
    if (qaLicense) {
      await page.waitForTimeout(3_000);
      const licenseInput = page.getByPlaceholder("XXXX-XXXX-XXXX-XXXX");
      await licenseInput.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      console.log(
        `[global-setup] QA license gate visible: ${await licenseInput.isVisible().catch(() => false)}`,
      );
      if ((await licenseInput.count()) && (await licenseInput.isVisible().catch(() => false))) {
        await licenseInput.fill(qaLicense);
        await page.getByRole("button", { name: /activate \/ verify/i }).click();
        await page.waitForTimeout(4_000);
        console.log(
          `[global-setup] after QA license: ${(await page.locator("body").innerText()).slice(0, 220).replace(/\s+/g, " ")}`,
        );
      }
      if (await page.getByTestId("setup-finish").count()) {
        await page.getByTestId("setup-shop-name").fill("MTJ QA Firm A");
        await page.getByTestId("setup-branch-name").fill("QA Main Branch");
        await page.getByTestId("setup-address").fill("QA test address");
        await page.getByTestId("setup-owner-name").fill("QA Firm Owner");
        await page.getByTestId("setup-finish").click();
        await page.waitForTimeout(1_000);
      }
    }
  } catch (err) {
    const pageUrl = page.url();
    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "N/A");
    console.warn(
      `[global-setup] UI login failed or timed out. Page URL: ${pageUrl}. Body preview: ${bodyText.slice(0, 300)}`,
      err,
    );
    await browser.close();
    throw new Error(
      `[global-setup] Real authenticated setup failed; refusing to create a mock session or fake seed data. ${String(err)}`,
    );
  }

  console.log("[global-setup] Waiting for window.__mtjSeed to be loaded");
  await page
    .waitForFunction(() => typeof (window as any).__mtjSeed === "function", { timeout: 45_000 })
    .catch(() => {
      console.warn("[global-setup] Timeout waiting for window.__mtjSeed");
    });
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(2000);

  let seedResult: Record<string, unknown> | null = null;
  try {
    seedResult = await page.evaluate(async () => {
      const w = window as unknown as {
        __mtjSeed?: () => Promise<Record<string, unknown>> | Record<string, unknown>;
      };
      if (typeof w.__mtjSeed === "function") {
        try {
          return await w.__mtjSeed();
        } catch (e) {
          console.warn("[global-setup] Error during seed in browser:", e);
          return null;
        }
      }
      return null;
    });
  } catch (evalErr) {
    console.warn("[global-setup] page.evaluate failed:", evalErr);
  }

  if (seedResult) {
    fs.writeFileSync(path.join(authDir, "seed.json"), JSON.stringify(seedResult, null, 2));
  } else if (fs.existsSync(path.join(authDir, "seed.json"))) {
    console.log("[global-setup] Reusing existing seed.json");
  } else {
    console.warn(
      "[global-setup] window.__mtjSeed() not completed — skipping data seed. " +
        "Tests that depend on pre-seeded records will fail individually. " +
        "__mtjSeed is only installed in DEV builds (import.meta.env.DEV).",
    );
  }

  const sessionStorageDump = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i);
      if (key) {
        data[key] = window.sessionStorage.getItem(key) || "";
      }
    }
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("sb-")) {
        data[key] = window.localStorage.getItem(key) || "";
      }
    }
    return data;
  });
  fs.writeFileSync(path.join(authDir, "session.json"), JSON.stringify(sessionStorageDump, null, 2));

  await page.context().storageState({ path: stateTmp });
  fs.renameSync(stateTmp, statePath);
  await browser.close();
  } finally {
    releaseLock();
  }
}
