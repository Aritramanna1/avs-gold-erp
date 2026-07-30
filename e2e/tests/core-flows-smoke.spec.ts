import { test, expect } from "../fixtures/base";

/**
 * Disposable-account smoke test: create a test staff account via the (now
 * verified working) invite flow, sign in as them, and hit each core module
 * route once, checking for a crash / blank screen / uncaught error. This is
 * a smoke test, not a functional deep-dive per module — its job is to catch
 * "the route doesn't render at all" class bugs across the whole app in one
 * pass, the same way the invite flow surfaced two production-breaking bugs.
 */
const MODULE_ROUTES = [
  "/",
  "/orders",
  "/workshop",
  "/people",
  "/stock",
  "/billing",
  "/reports",
  "/settings",
];

test.describe("Core module smoke test (signed out -> disposable account)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("accept a disposable staff invite, then load every core module route without crashing", async ({
    page,
  }) => {
    await page.goto("/invite/accept?code=TEST-STAFF-003&email=e2e-staff-test%40example.com");
    await expect(page.locator("#invite-name")).toBeVisible({ timeout: 20_000 });
    await page.locator("#invite-name").fill("E2E Staff Test");
    await page.locator("#invite-password").fill("TestPass!2026");
    await page.locator("#invite-confirm-password").fill("TestPass!2026");
    await page.getByRole("button", { name: /activate account/i }).click();
    await expect(page.getByText(/welcome to/i).first()).toBeVisible({ timeout: 25_000 });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`[pageerror] ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(`[console] ${m.text()}`);
    });

    const results: Record<string, string> = {};
    for (const route of MODULE_ROUTES) {
      errors.length = 0;
      try {
        await page.goto(route, { timeout: 20_000, waitUntil: "domcontentloaded" });
        await page.waitForTimeout(1_500);
        const bodyText = await page
          .locator("body")
          .innerText()
          .catch(() => "");
        const blank = bodyText.trim().length < 20;
        results[route] = blank
          ? `BLANK (${bodyText.length} chars)`
          : errors.length > 0
            ? `ERRORS: ${errors.slice(0, 3).join(" | ")}`
            : "OK";
      } catch (e) {
        results[route] = `NAV FAILED: ${e instanceof Error ? e.message : String(e)}`;
      }
    }

    console.log("MODULE SMOKE RESULTS:\n" + JSON.stringify(results, null, 2));

    const failures = Object.entries(results).filter(([, v]) => v !== "OK");
    expect(failures, `Failing routes: ${JSON.stringify(failures, null, 2)}`).toEqual([]);
  });
});
