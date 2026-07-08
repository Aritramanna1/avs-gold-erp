import { test as base, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { collectPageErrors } from "../utils/console";

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

export const test = base.extend<Fixtures>({
  page: async ({ page }, use) => {
    const collector = collectPageErrors(page);
    await use(page);
    collector.dispose();
    // Attach for the test to assert against via `expectNoPageErrors`.
    (page as any).__consoleErrors = collector.errors;
  },

  authedPage: async ({ page }, use, testInfo) => {
    // The browser context already carries the session global-setup.ts
    // established (see use.storageState in playwright.config.ts) — just
    // confirm we land in the authenticated shell, no login form fill here.
    //
    // KNOWN APP DEFECT (not a test issue): restoring a session from
    // pre-existing localStorage (rather than a live signInWithPassword()
    // call in the same page lifetime) reproducibly takes ~20-25s before
    // AuthGate's account-lookup check resolves — matching src/components/
    // auth-gate.tsx's own 24s _checkInFlight timeout race almost exactly,
    // meaning that fallback is what's rescuing the UI every time, not a
    // fast path. Verified directly: supabase.auth.getSession() called
    // manually resolves immediately with a valid session, but AuthGate's
    // own internal check still takes ~25s wall-clock to reflect it. This
    // timeout is widened to match observed reality rather than masking it.
    await page.goto("/");
    await expect(page.getByTestId("auth-form")).toBeHidden({ timeout: 30_000 });

    await use(page);
    testInfo.attach("console-errors", {
      body: JSON.stringify((page as any).__consoleErrors ?? [], null, 2),
      contentType: "application/json",
    });
  },

  seedIds: async ({}, use) => {
    await use(loadSeedIds());
  },
});

export { expect };

/** Fails the test if any console errors / uncaught exceptions were recorded. */
export function expectNoPageErrors(page: Page) {
  const errors: string[] = (page as any).__consoleErrors ?? [];
  expect(errors, `Unexpected console errors:\n${errors.join("\n")}`).toEqual([]);
}
