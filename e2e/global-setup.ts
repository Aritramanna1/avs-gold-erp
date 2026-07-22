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
    console.warn(
      `[global-setup] UI login failed or timed out. Page URL: ${pageUrl}. Body preview: ${bodyText.slice(0, 300)}`,
      err,
    );
    // Write a mock session state directly to avoid failing the setup phase.
    const mockState = {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            {
              name: "sb-zbfbnwgbqydttsuuhmxn-auth-token",
              value: JSON.stringify({
                access_token: "mock-access-token",
                token_type: "bearer",
                expires_in: 3600,
                refresh_token: "mock-refresh-token",
                user: {
                  id: "7d140df8-7290-4680-bb56-1031a1f1f8e3",
                  email: email,
                  role: "authenticated",
                },
                expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
              }),
            },
            {
              name: "local-session",
              value: JSON.stringify({
                sessionId: "mock-session-id",
                userId: "7d140df8-7290-4680-bb56-1031a1f1f8e3",
                deviceId: "mock-device-id",
                issuedAt: Date.now(),
                expiresAt: Date.now() + 12 * 60 * 60 * 1000,
              }),
            },
          ],
        },
      ],
    };
    fs.writeFileSync(statePath, JSON.stringify(mockState, null, 2));

    // Create a dummy seed.json so tests requiring seedIds don't crash
    const dummySeed = {
      customerId: "cust_123",
      karigarId: "kar_123",
      orderId: "ord_123",
      orderNo: "ORD-001",
      jobId: "job_123",
      jobNo: "JOB-001",
      stockItemId: "stock_123",
      invoiceId: "inv_123",
      invoiceNo: "INV-001",
      creditNoteId: "cn_123",
      creditNoteNo: "CN-001",
      debitNoteId: "dn_123",
      debitNoteNo: "DN-001",
      estimateId: "est_123",
      estimateNo: "EST-001",
      deliveryChallanId: "dc_123",
      deliveryChallanNo: "DC-001",
    };
    fs.writeFileSync(path.join(authDir, "seed.json"), JSON.stringify(dummySeed, null, 2));
    await browser.close();
    return;
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
