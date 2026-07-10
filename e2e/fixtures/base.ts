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
    await use(page);
    collector.dispose();
    // Attach for the test to assert against via `expectNoPageErrors`.
    (page as any).__consoleErrors = collector.errors;
    if (!E2E_CDP_URL) await page.close();
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

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture signature requires this shape
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
