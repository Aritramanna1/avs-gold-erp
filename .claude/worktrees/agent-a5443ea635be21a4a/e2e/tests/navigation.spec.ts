import { test, expect, expectNoPageErrors } from "../fixtures/base";

const MODULE_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: "/", heading: /./ },
  { path: "/people", heading: /./ },
  { path: "/orders", heading: /./ },
  { path: "/workshop", heading: "Workshop" },
  { path: "/manufacturing", heading: "Manufacturing" },
  { path: "/melt", heading: "Melt Account" },
  { path: "/stock", heading: "Stock" },
  { path: "/billing", heading: "Billing" },
  { path: "/reports", heading: "Reports" },
  { path: "/communications", heading: "Communications & CRM" },
  { path: "/settings", heading: "Settings" },
  { path: "/hardware", heading: "Hardware Management" },
];

test.describe("Navigation", () => {
  for (const route of MODULE_ROUTES) {
    test(`navigating directly to ${route.path} renders its module (no dead route)`, async ({
      authedPage,
    }) => {
      await authedPage.goto(route.path);
      // A full page reload cold-compiles this route's module in Vite dev
      // mode, which is slower than a production build — allow generous time.
      await expect(authedPage.locator("h1")).toBeVisible({ timeout: 30_000 });
      if (typeof route.heading === "string") {
        await expect(authedPage.locator("h1")).toHaveText(route.heading);
      }
      expectNoPageErrors(authedPage);
    });
  }

  test("an unknown route does not crash the app", async ({ authedPage }) => {
    await authedPage.goto("/this-route-does-not-exist-e2e");
    // Either a 404 view or a redirect — either way the app must not crash.
    await expect(authedPage.locator("body")).toBeVisible();
    expectNoPageErrors(authedPage);
  });
});
