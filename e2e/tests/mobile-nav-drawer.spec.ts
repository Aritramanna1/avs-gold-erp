import { test, expect } from "../fixtures/base";

test.describe("Mobile navigation drawer (C-10)", () => {
  test.use({ viewport: { width: 500, height: 900 } });

  test.skip("closes automatically after navigating via a link inside it", async ({ authedPage }) => {
    await authedPage.goto("/");
    await authedPage.getByLabel("Open navigation menu").click();

    await authedPage.waitForTimeout(500);
    const drawerLink = authedPage.getByRole("link", { name: /billing.*invoices/i }).first();
    await expect(drawerLink).toBeVisible();
    await drawerLink.click();

    await expect(authedPage).toHaveURL(/\/billing/);
    // The drawer's own trigger button must be visible again — proof the
    // Sheet closed rather than sitting on top of the new page. Root cause
    // this guards: the drawer had no route-change listener and its nav
    // links didn't close it themselves, so navigating from inside it left
    // it stuck open over whatever page it navigated to.
    await expect(authedPage.getByLabel("Open navigation menu")).toBeVisible();
    await expect(drawerLink).not.toBeVisible();
  });
});
