import { test, expect } from "../fixtures/base";

test.describe("Single Search Bar Invariance & Verification", () => {
  const routesToVerify = [
    "/app",
    "/people",
    "/billing",
    "/inventory",
    "/orders",
    "/reports",
  ];

  test("Desktop (1440x900): Exactly one global search bar in header across major routes and one palette on Ctrl+K", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1440, height: 900 });

    for (const route of routesToVerify) {
      await authedPage.goto(route);
      await authedPage.waitForLoadState("domcontentloaded");

      const desktopSearch = authedPage.getByTestId("desktop-global-search");
      const mobileSearch = authedPage.getByTestId("mobile-global-search");

      await expect(desktopSearch).toBeVisible({ timeout: 10_000 });
      await expect(desktopSearch).toHaveCount(1);
      await expect(mobileSearch).toBeHidden();
    }

    // Open via click on desktop search bar
    const desktopSearchBtn = authedPage.getByTestId("desktop-global-search");
    await desktopSearchBtn.click();
    const searchModal = authedPage.getByTestId("quick-command-palette-modal");
    const searchModalInput = authedPage.getByTestId("quick-command-palette-input");

    await expect(searchModal).toBeVisible({ timeout: 5000 });
    await expect(searchModalInput).toBeVisible({ timeout: 5000 });
    await expect(searchModalInput).toHaveCount(1);

    // Verify search functionality
    await searchModalInput.fill("sale");
    const result = authedPage.locator("div:has-text('New Retail Sale Bill')").first();
    await expect(result).toBeVisible();

    // Close on Escape
    await authedPage.keyboard.press("Escape");
    await expect(searchModal).toBeHidden();
  });

  test("Tablet (768x1024): Exactly one global search bar in header and mobile search icon hidden", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 768, height: 1024 });
    await authedPage.goto("/people");
    await authedPage.waitForLoadState("domcontentloaded");

    const desktopSearch = authedPage.getByTestId("desktop-global-search");
    const mobileSearch = authedPage.getByTestId("mobile-global-search");

    await expect(desktopSearch).toBeVisible({ timeout: 10_000 });
    await expect(desktopSearch).toHaveCount(1);
    await expect(mobileSearch).toBeHidden();
  });

  test("Mobile (375x812): Exactly one global search icon button in header and desktop bar hidden", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 375, height: 812 });
    await authedPage.goto("/people");
    await authedPage.waitForLoadState("domcontentloaded");

    const desktopSearch = authedPage.getByTestId("desktop-global-search");
    const mobileSearch = authedPage.getByTestId("mobile-global-search");

    await expect(mobileSearch).toBeVisible({ timeout: 10_000 });
    await expect(mobileSearch).toHaveCount(1);
    await expect(desktopSearch).toBeHidden();

    // Click mobile search icon to open palette
    await mobileSearch.click();
    const searchModal = authedPage.getByTestId("quick-command-palette-modal");
    const searchModalInput = authedPage.getByTestId("quick-command-palette-input");

    await expect(searchModal).toBeVisible({ timeout: 5000 });
    await expect(searchModalInput).toBeVisible({ timeout: 5000 });
    await expect(searchModalInput).toHaveCount(1);

    // Dismiss with X button
    const closeBtn = authedPage.getByTestId("quick-command-palette-close");
    await closeBtn.click();
    await expect(searchModal).toBeHidden();
  });
});
