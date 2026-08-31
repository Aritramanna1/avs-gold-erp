import { test, expect } from "@playwright/test";

test.describe("Mobile and tablet smoke", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("marketing verify page loads on mobile", async ({ page }) => {
    await page.goto("/verify");
    await expect(page.locator("body")).toBeVisible();
  });

  test("ERP login layout on mobile", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Tablet viewport", () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  test("portal welcome layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });
});
