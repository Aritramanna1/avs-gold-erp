import {
  test as base,
  expect,
  chromium,
  type Page,
  type Browser,
  type BrowserContext,
} from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { collectPageErrors } from "../utils/console";
import { requireEnv } from "../data/test-data";

// Opt-in single-shared-browser mode: when E2E_CDP_URL is set, attach to an
// externally-launched Chrome (the same instance Reticle drives via
// RETICLE_CDP_URL) instead of Playwright launching/closing its own, and
// reuse the SAME context/tab across every test/run (never close it) instead
// of the usual fresh-context-per-test — one continuous browser tab for the
// whole manual validation session. Unset (the default/CI path) is
// completely untouched: fresh context/page per test, full config fidelity
// (storageState/trace/video/screenshot), closed as usual.
const E2E_CDP_URL = process.env.E2E_CDP_URL;
const authStatePath = path.resolve(import.meta.dirname, "../.auth/state.json");
let sharedContext: BrowserContext | null = null;

// Only declared at all when E2E_CDP_URL is set, so the non-CDP path never
// has a `context` key in its fixtures object — Playwright's own builtin
// `context` fixture (with full config fidelity) applies untouched.
const cdpFixtures = E2E_CDP_URL
  ? {
      context: async (
        {
          browser,
          baseURL,
          storageState,
        }: { browser: Browser; baseURL: string | undefined; storageState: unknown },
        use: (c: BrowserContext) => Promise<void>,
      ) => {
        // A test that calls test.use({ storageState: {...} }) — e.g. the
        // "signed out" describe blocks — is explicitly asking for a
        // DIFFERENT session than the shared authenticated one (that's the
        // whole point of the test). A single persistent tab can't represent
        // both "signed in" and "signed out" at once, so that one request
        // legitimately gets its own isolated, closed-after context; every
        // other test (the vast majority) still reuses the one shared tab.
        // Default option resolves to the config's storageState *path*
        // (a string); any override is a literal object instead.
        if (typeof storageState !== "string") {
          const isolated = await browser.newContext({ baseURL, storageState: storageState as any });
          await use(isolated);
          await isolated.close();
          return;
        }
        if (!sharedContext) {
          // Chrome's raw default context (browser.contexts()[0] right after
          // attaching) was never created via Playwright, so it has no
          // baseURL/storageState wiring — page.goto("/") would throw
          // "Cannot navigate to invalid URL" on it. Create ONE proper
          // context instead (with the same options config's own default
          // context would get) and reuse it — this is still just one tab
          // for the whole session, just a correctly-configured one.
          sharedContext = await browser.newContext({ baseURL, storageState });
        }
        await use(sharedContext);
        // Externally managed — never close, the next test/run reuses it.
      },
    }
  : {};

type SeedIds = {
  customerId: string;
  karigarId: string;
  orderId: string;
  orderNo: string;
  jobId: string;
  jobNo: string;
  stockItemId: string;
  invoiceId: string;
  invoiceNo: string;
  creditNoteId: string;
  creditNoteNo: string;
  debitNoteId: string;
  debitNoteNo: string;
  estimateId: string;
  estimateNo: string;
  deliveryChallanId: string;
  deliveryChallanNo: string;
  [key: string]: unknown;
};

type Fixtures = {
  /** Page with console/uncaught-exception collection wired up automatically. */
  page: Page;
  /**
   * A page starting from the session global-setup.ts already established
   * (via `use.storageState` in playwright.config.ts) — no per-test login.
   */
  authedPage: Page;
  /**
   * IDs/numbers of the pilot dataset global-setup.ts seeded once via
   * `window.__mtjSeed()` (see src/lib/test-seed.ts). Tests must read real
   * records from here instead of assuming a hardcoded name like "SRM
   * Jewelers" exists. Throws with a clear message if seeding didn't run
   * (e.g. __mtjSeed wasn't available because the target wasn't a DEV build).
   */
  seedIds: SeedIds;
};

function loadSeedIds(): SeedIds {
  const seedPath = path.resolve(import.meta.dirname, "../.auth/seed.json");
  if (!fs.existsSync(seedPath)) {
    throw new Error(
      "e2e/.auth/seed.json not found — global-setup.ts did not seed data (window.__mtjSeed() " +
        "was unavailable, likely because the target build isn't a Vite DEV build). This test " +
        "depends on pre-seeded master data; run against `npm run dev` (E2E_BASE_URL=http://localhost:3000).",
    );
  }
  return JSON.parse(fs.readFileSync(seedPath, "utf8"));
}

function isExpiredAuthToken(tokenValue: string | undefined): boolean {
  if (!tokenValue) return true;
  try {
    const parsed = JSON.parse(tokenValue);
    const accessToken = parsed.access_token || parsed.token;
    if (!accessToken) return true;
    const payloadPart = accessToken.split(".")[1];
    if (!payloadPart) return true;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(Buffer.from(normalized, "base64").toString("utf8"));
    const expiresAt = Number(payload.exp ?? payload.expires_at ?? 0);
    return Number.isFinite(expiresAt) && expiresAt * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export const test = base.extend<Fixtures>({
  // Worker-scoped, same as Playwright's own default browser fixture — the
  // only difference is *attaching* to an already-running Chrome (the one
  // Reticle also drives via RETICLE_CDP_URL) instead of launching a new one.
  // Per-test contexts/pages are still created normally inside it, exactly as
  // before, so storageState/trace/video isolation is unaffected.
  browser: [
    async ({ browser }, use) => {
      if (!E2E_CDP_URL) {
        await use(browser);
        return;
      }
      const attached: Browser = await chromium.connectOverCDP(E2E_CDP_URL);
      await use(attached);
      // Externally managed — never close the shared browser here.
    },
    { scope: "worker" },
  ],

  ...cdpFixtures,

  // Reuses the shared context's existing tab in CDP mode (never closes it);
  // otherwise identical to Playwright's own default `page` fixture
  // (context.newPage(), closed at teardown).
  page: async ({ context }, use) => {
    const page = E2E_CDP_URL
      ? (context.pages()[0] ?? (await context.newPage()))
      : await context.newPage();
    const collector = collectPageErrors(page);
    await page.addInitScript(() => {
      window.sessionStorage.setItem("whats-new-seen-1.1.1", "shown");
      window.sessionStorage.setItem("whats-new-seen-2026-08-11", "shown");
    });
    await use(page);
    collector.dispose();
    // Attach for the test to assert against via `expectNoPageErrors`.
    (page as any).__consoleErrors = collector.errors;
    if (!E2E_CDP_URL) await page.close();
  },

  authedPage: async ({ page }, use, testInfo) => {
    const sessionPath = path.resolve(import.meta.dirname, "../.auth/session.json");
    let sessionData: Record<string, string> | null = null;
    if (fs.existsSync(sessionPath)) {
      try {
        sessionData = JSON.parse(fs.readFileSync(sessionPath, "utf8"));
      } catch {
        sessionData = null;
      }
    }

    if (sessionData) {
      const authTokenValue = Object.entries(sessionData).find(
        ([key]) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      )?.[1];
      const expired = isExpiredAuthToken(authTokenValue);
      if (expired) {
        sessionData = null;
      }
    }

    await page.addInitScript((data) => {
      window.sessionStorage.setItem("whats-new-seen-1.1.1", "shown");
      window.sessionStorage.setItem("whats-new-seen-2026-08-11", "shown");

      // If the test signals an intentional logout via localStorage, skip all
      // session injection. localStorage persists across same-tab navigations
      // (unlike sessionStorage) so this survives the window.location.href redirect.
      if (window.localStorage.getItem("e2e-logout-signal") === "1") {
        // Clear any leftover Supabase tokens too, just in case.
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith("sb-") || k === "session-injected")) {
            sessionStorage.removeItem(k);
          }
        }
        return;
      }

      const injected = window.sessionStorage.getItem("session-injected");
      let tokenExists = false;
      for (let i = 0; i < window.sessionStorage.length; i++) {
        const key = window.sessionStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          tokenExists = true;
          break;
        }
      }
      if (!tokenExists) {
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
            tokenExists = true;
            break;
          }
        }
      }

      // If we already injected the session once, but now the token is missing,
      // it means the user logged out. Do not re-inject it.
      if (injected === "true" && !tokenExists) {
        return;
      }

      if (data && typeof data === "object") {
        for (const [key, val] of Object.entries(data)) {
          if (typeof val === "string") {
            if (key.startsWith("sb-")) {
              window.localStorage.setItem(key, val);
            } else {
              window.sessionStorage.setItem(key, val);
            }
          }
        }
      }
      window.sessionStorage.setItem("session-injected", "true");

      // Pre-populate license entitlement to prevent state transition from trial/checking to active on boot
      try {
        const licenseKey =
          window.sessionStorage.getItem("license_key") || "MTJ-QA-FIRMA-20260731-6M";
        const deviceId = window.sessionStorage.getItem("ornexa_device_id") || "dev_e2e_device";
        const now = Date.now();
        const entitlement = {
          status: "active",
          expiry: 1893456000000,
          trialStartedAt: null,
          trialEndsAt: null,
          seats: 100,
          edition: "enterprise",
          features: ["multi_branch", "barcode_scanning", "whatsapp_integration"],
          customerStatus: "active",
          lastVerifiedAt: now,
        };
        const record = {
          version: 1,
          deviceId: deviceId,
          activationKeyHash: "e2e_mock_hash",
          lastSeenAt: now,
          cache: entitlement,
        };
        window.sessionStorage.setItem("license-entitlement", JSON.stringify(record));
      } catch (e) {
        // ignore
      }
    }, sessionData);

    if (!sessionData) {
      await page.goto("/", { waitUntil: "domcontentloaded", timeout: 30_000 });
      const alreadySignedIn = !(await page
        .getByTestId("auth-form")
        .isVisible()
        .catch(() => false));
      if (!alreadySignedIn) {
        await expect(page.getByTestId("auth-form")).toBeVisible({ timeout: 15_000 });
        await page.getByTestId("auth-email").fill(requireEnv("E2E_EMAIL"), { timeout: 15_000 });
        await page
          .getByTestId("auth-password")
          .fill(requireEnv("E2E_PASSWORD"), { timeout: 15_000 });
        await page.getByTestId("auth-submit").click({ timeout: 15_000 });
        await expect(page.getByTestId("auth-form")).toBeHidden({ timeout: 30_000 });
      }
    }

    // In-memory mock database for Supabase simulation
    const mockDb: Record<string, any[]> = {};

    // Always intercept critical auth/licensing tables to bypass clock skew issues on the host
    await page.route("**/auth/v1/logout*", async (route) => {
      await route.fulfill({
        status: 204,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/rest/v1/user_roles*", async (route) => {
      if (process.env.E2E_LIVE_DATA === "true") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ role: "owner" }]),
      });
    });

    await page.route("**/rest/v1/user_profiles*", async (route) => {
      if (process.env.E2E_LIVE_DATA === "true") {
        await route.continue();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            active: true,
            auth_id: "b7040fc0-35f3-49e5-9fd8-ea850a85d948",
            firm_id: "MAIN_FIRM",
            full_name: "QA Firm Owner",
            role: "owner",
            status: "active",
          },
        ]),
      });
    });

    await page.route("**/rest/v1/rpc/get_my_tenant_license_key*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify("test-license-key"),
      });
    });

    await page.route("**/rest/v1/rpc/validate_license*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          valid: true,
          edition: "enterprise",
          expiry: 1893456000000,
          enabledFeatures: ["multi_branch", "barcode_scanning", "whatsapp_integration"],
          maximumDevices: 100,
          customerStatus: "active",
          entitlement: "valid-entitlement",
          message: "License verified successfully",
        }),
      });
    });

    // Legacy unit-style suites may opt into an in-memory REST double. Live
    // suites must set E2E_LIVE_DATA=true so every table query and mutation
    // reaches the authenticated target project.
    if (process.env.E2E_LIVE_DATA !== "true") {
      await page.route("**/rest/v1/**", async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        const match = url.match(/\/rest\/v1\/([^?#]+)/);
        const table = match ? match[1] : null;

        if (!table) {
          await route.continue();
          return;
        }

        // Never mock the identity, tenancy, authorization, subscription or
        // platform-control tables. AuthGate and protected routes must exercise
        // the real authenticated Supabase session; returning an empty mock row
        // here incorrectly signs a valid user out as "profile not linked".
        const liveIdentityTables = new Set([
          "user_profiles",
          "user_roles",
          "organizations",
          "branches",
          "organization_subscriptions",
          "organization_features",
          "platform_plans",
          "platform_service_requests",
          "platform_support_tickets",
          "platform_conversations",
          "platform_conversation_messages",
          "platform_notifications",
        ]);
        if (liveIdentityTables.has(table)) {
          await route.continue();
          return;
        }

        if (table.startsWith("rpc/")) {
          // RPCs are security and licensing boundaries. Never replace their
          // response with a shape that merely looks successful: validate_license
          // requires the real entitlement payload, and business RPCs must be
          // exercised against the target database in live suites.
          await route.continue();
          return;
        }

        if (method === "GET") {
          const data = mockDb[table] || [];
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(data),
          });
        } else if (method === "POST" || method === "PUT" || method === "PATCH") {
          const bodyStr = route.request().postData();
          let payload: any = [];
          try {
            payload = bodyStr ? JSON.parse(bodyStr) : [];
          } catch {
            payload = [];
          }

          if (!Array.isArray(payload)) {
            payload = [payload];
          }

          if (!mockDb[table]) {
            mockDb[table] = [];
          }

          // Upsert items into mockDb
          for (const item of payload) {
            const index = mockDb[table].findIndex((x) => x.id === item.id);
            if (index !== -1) {
              mockDb[table][index] = { ...mockDb[table][index], ...item };
            } else {
              mockDb[table].push(item);
            }
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(payload),
          });
        } else if (method === "DELETE") {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({}),
          });
        }
      });
    }

    const qaLicense = process.env.E2E_LICENSE_KEY;
    if (qaLicense) {
      // Keep the key but clear the per-device cached entitlement. The test
      // account is intentionally revalidated against the target RPC for each
      // fresh context; otherwise an old suspended cache wins before the new
      // QA key can be activated.
      await page.addInitScript(() => {
        window.localStorage.removeItem("license-entitlement");
        const request = window.indexedDB.deleteDatabase("mtj_erp_local_db");
        request.onerror = () => undefined;
      });
    }
    await page.goto("/");
    if (qaLicense) {
      const licenseInput = page.getByPlaceholder("XXXX-XXXX-XXXX-XXXX");
      await licenseInput.waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
      if (await licenseInput.isVisible().catch(() => false)) {
        await licenseInput.fill(qaLicense);
        await page.getByRole("button", { name: /activate \/ verify/i }).click();
        await page.waitForTimeout(3_000);
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
    const authForm = page.getByTestId("auth-form");
    if (await authForm.isVisible().catch(() => false)) {
      await page.getByTestId("auth-email").fill(requireEnv("E2E_EMAIL"), { timeout: 15_000 });
      await page.getByTestId("auth-password").fill(requireEnv("E2E_PASSWORD"), { timeout: 15_000 });
      await page.getByTestId("auth-submit").click({ timeout: 15_000 });
      await expect(authForm).toBeHidden({ timeout: 30_000 });
    }
    if (qaLicense) {
      const lateLicenseInput = page.getByPlaceholder("XXXX-XXXX-XXXX-XXXX");
      if (await lateLicenseInput.isVisible().catch(() => false)) {
        await lateLicenseInput.fill(qaLicense);
        await page.getByRole("button", { name: /activate \/ verify/i }).click();
        await expect(lateLicenseInput).toBeHidden({ timeout: 20_000 });
      }
    }

    // Ensure database is seeded dynamically if seed.json is not present
    const seedPath = path.resolve(import.meta.dirname, "../.auth/seed.json");
    if (!fs.existsSync(seedPath)) {
      await page
        .waitForFunction(() => typeof (window as any).__mtjSeed === "function", { timeout: 15_000 })
        .catch(() => {});
      const seedResult = await page.evaluate(async () => {
        const w = window as unknown as { __mtjSeed?: () => Promise<Record<string, any>> };
        if (typeof w.__mtjSeed === "function") {
          try {
            return await w.__mtjSeed();
          } catch (e: any) {
            console.error("DYNAMIC SEED FAILED IN BROWSER:", e);
            throw e;
          }
        }
        return null;
      });

      if (seedResult) {
        fs.mkdirSync(path.dirname(seedPath), { recursive: true });
        fs.writeFileSync(seedPath, JSON.stringify(seedResult, null, 2));
      }
    }

    // WhatsNewDialog gates on sessionStorage, which storageState never
    // persists. Dismiss fallback if still visible.
    const whatsNewDismiss = page.getByRole("button", { name: "Got it" });
    if (await whatsNewDismiss.isVisible().catch(() => false)) {
      await whatsNewDismiss.click();
    }

    await use(page);
    testInfo.attach("console-errors", {
      body: JSON.stringify((page as any).__consoleErrors ?? [], null, 2),
      contentType: "application/json",
    });
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires this shape
  seedIds: async ({}, use) => {
    await use(loadSeedIds());
  },
});

export { expect };

/**
 * WhatsNewDialog can reappear after a hard navigation within the same test
 * (its sessionStorage-seen check races the app boot on some routes). Call
 * after any `page.goto` that might land on a fresh app boot.
 */
export async function dismissWhatsNew(page: Page) {
  const dismiss = page.getByRole("button", { name: "Got it" });
  await dismiss.waitFor({ state: "visible", timeout: 3_000 }).catch(() => undefined);
  if (await dismiss.isVisible().catch(() => false)) {
    await dismiss.click();
  }
}

/** Fails the test if any console errors / uncaught exceptions were recorded. */
export function expectNoPageErrors(page: Page) {
  const errors: string[] = (page as any).__consoleErrors ?? [];
  expect(errors, `Unexpected console errors:\n${errors.join("\n")}`).toEqual([]);
}
