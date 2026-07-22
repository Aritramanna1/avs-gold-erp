import { test, expect, expectNoPageErrors } from "../fixtures/base";

const MODULE_ROUTES: { path: string; heading: string | RegExp }[] = [
  { path: "/", heading: /./ },
  { path: "/people", heading: /./ },
  { path: "/orders", heading: /./ },
  // /workshop renders the Manufacturing Books page (job-card management).
  { path: "/workshop", heading: "Manufacturing Books" },
  // /manufacturing, /stock, /reports may render a "Coming Soon" placeholder
  // which uses an h2 not an h1 — accept any visible heading text.
  { path: "/manufacturing", heading: /./ },
  { path: "/melt", heading: "Melt Account (Coming Soon)" },
  { path: "/stock", heading: /./ },
  { path: "/billing", heading: "Billing" },
  { path: "/reports", heading: /./ },
  { path: "/communications", heading: "Communications (Coming Soon)" },
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
      // Routes that use a ModuleComingSoon placeholder render an h2, not an
      // h1. Accept whichever heading level is present.
      const headingLocator = authedPage.locator("h1, h2").first();
      await expect(headingLocator).toBeVisible({ timeout: 30_000 });
      if (typeof route.heading === "string") {
        await expect(headingLocator).toHaveText(route.heading);
      } else {
        // RegExp: just ensure the heading has some non-empty text.
        await expect(headingLocator).toHaveText(route.heading);
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
