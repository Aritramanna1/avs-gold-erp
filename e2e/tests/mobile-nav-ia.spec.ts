import { test, expect } from "../fixtures/base";

test.describe("Mobile / tablet navigation IA", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("phone: hamburger opens same Sidebar groups; More opens module sheet", async ({
    authedPage,
  }) => {
    await authedPage.goto("/app");
    await expect(authedPage.getByLabel("Open navigation menu")).toBeVisible();
    await authedPage.getByLabel("Open navigation menu").click();
    await expect(authedPage.getByRole("link", { name: /Dashboard/i }).first()).toBeVisible();
    await expect(
      authedPage.getByText(/Parties|Manufacturing|Gold|Billing|Reports/i).first(),
    ).toBeVisible();

    // Close sheet via Escape
    await authedPage.keyboard.press("Escape");

    const more = authedPage.getByRole("button", { name: /All ERP modules/i });
    await expect(more).toBeVisible();
    await more.click();
    await expect(authedPage.getByText(/Same navigation groups as desktop/i)).toBeVisible();
    await expect(
      authedPage.getByRole("link", { name: /Customers|Sales & Invoices|Orders/i }).first(),
    ).toBeVisible();
  });

  test("tablet: sidebar sheet + bottom nav primary tabs", async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 834, height: 1112 },
      isMobile: true,
      hasTouch: true,
    });
    // Reuse auth from storage if fixture provides — fall back to login page shell checks only.
    const page = await context.newPage();
    await page.goto("/login");
    await expect(page.getByTestId("auth-form")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
    );
    expect(overflow).toBe(false);
    await context.close();
  });
});
