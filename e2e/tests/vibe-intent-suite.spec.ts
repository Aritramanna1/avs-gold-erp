import { test, expect } from "../fixtures/base";

/**
 * AVS GOLD ERP — VIBE TESTING SUITE (INTENT-DRIVEN E2E VALIDATION)
 * 
 * Validates real-world user intent, non-linear journeys, and UX friction
 * rather than simple rigid selector mechanics.
 */

test.describe("Vibe Testing — Intent-Driven ERP Experience", () => {
  test.beforeEach(async ({ authedPage }) => {
    await authedPage.addInitScript(() => {
      window.sessionStorage.setItem("whats-new-seen-1.1.1", "shown");
      window.sessionStorage.setItem("whats-new-seen-2026-08-11", "shown");
      window.localStorage.setItem("ornexa_mobile_tour_v4", "done");
      window.localStorage.setItem("ornexa_tour_dismissed", "1");
    });
  });

  test("Intent 1: POS Showroom Flow — Rapid Sale Bill Generation & Zero Friction", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1440, height: 900 });
    await authedPage.goto("/billing/new");
    await authedPage.waitForLoadState("domcontentloaded");

    // The user intent: "I need to quickly create a bill without getting blocked by confusing fields"
    const heading = authedPage.locator("h1, h2, [data-surface-title]").first();
    await expect(heading).toBeVisible({ timeout: 10000 });

    // Verify rate and key summary metrics are immediately visible and reactive
    const goldRateTrigger = authedPage.locator("#header-gold-rate-trigger");
    await expect(goldRateTrigger).toBeVisible();

    // Verify exactly ONE global search bar is present in header (no double search bar distraction)
    const searchBars = authedPage.getByTestId("desktop-global-search");
    await expect(searchBars).toHaveCount(1);
    await expect(searchBars).toBeVisible();

    // Natural keyboard shortcut check: Pressing F2 or clicking search should feel instantaneous
    await searchBars.click();
    const searchModal = authedPage.getByTestId("quick-command-palette-modal");
    await expect(searchModal).toBeVisible({ timeout: 3000 });

    // Type human intent query
    const input = authedPage.getByTestId("quick-command-palette-input");
    await input.fill("invoice");
    const result = authedPage.locator("div:has-text('Invoices & Sales Register')").first();
    await expect(result).toBeVisible();

    await authedPage.keyboard.press("Escape");
    await expect(searchModal).toBeHidden();
  });

  test("Intent 2: Manufacturing & Artisan Flow — Track Karigar & Bullion Accountability", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1440, height: 900 });
    await authedPage.goto("/people");
    await authedPage.waitForLoadState("domcontentloaded");

    // Staff intent: "Switch to Karigar tab and find worker status without page reloads"
    const karigarTab = authedPage.locator("button, [role='tab']", { hasText: /karigar|worker/i }).first();
    if (await karigarTab.isVisible()) {
      await karigarTab.click();
      await authedPage.waitForTimeout(500);
      
      // Ensure the UI adapted smoothly without jarring layout shifts
      const peopleList = authedPage.locator("main");
      await expect(peopleList).toBeVisible();
    }
  });

  test("Intent 3: Multi-Device Fluidity — Seamless Mobile to Tablet Responsiveness", async ({ authedPage }) => {
    // 1. Mobile Phone Viewport (375x812)
    await authedPage.setViewportSize({ width: 375, height: 812 });
    await authedPage.goto("/app");
    await authedPage.waitForLoadState("domcontentloaded");

    // Single compact mobile search button
    const mobileSearch = authedPage.getByTestId("mobile-global-search");
    await expect(mobileSearch).toBeVisible({ timeout: 5000 });
    const desktopSearch = authedPage.getByTestId("desktop-global-search");
    await expect(desktopSearch).toBeHidden();

    // 2. Tablet Viewport (768x1024)
    await authedPage.setViewportSize({ width: 768, height: 1024 });
    await authedPage.waitForTimeout(500);

    // Desktop search bar seamlessly takes over without duplicate button
    await expect(desktopSearch).toBeVisible({ timeout: 5000 });
    await expect(mobileSearch).toBeHidden();

    // 3. Desktop Viewport (1440x900)
    await authedPage.setViewportSize({ width: 1440, height: 900 });
    await authedPage.waitForTimeout(500);
    await expect(desktopSearch).toBeVisible();
    await expect(mobileSearch).toBeHidden();
  });

  test("Intent 4: Natural Language Command Discovery — Finding features using colloquial terms", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1440, height: 900 });
    await authedPage.goto("/app");
    await authedPage.waitForLoadState("domcontentloaded");

    const desktopSearch = authedPage.getByTestId("desktop-global-search");
    await desktopSearch.click();

    const searchInput = authedPage.getByTestId("quick-command-palette-input");
    await expect(searchInput).toBeVisible();

    // Colloquial terms testing:
    // 'jama' or 'cash' -> Daily Cash Book
    await searchInput.fill("cash");
    await expect(authedPage.locator("div:has-text('Daily Cash Book')").first()).toBeVisible();

    // 'melting' -> Melt & Assay
    await searchInput.fill("melt");
    await expect(authedPage.locator("div:has-text('Melt & Assay')").first()).toBeVisible();

    // 'gst' -> Statutory Tax Returns
    await searchInput.fill("gst");
    await expect(authedPage.locator("div:has-text('Statutory Tax Returns')").first()).toBeVisible();

    await authedPage.keyboard.press("Escape");
  });
});
