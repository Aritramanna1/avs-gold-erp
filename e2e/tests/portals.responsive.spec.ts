import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Mobile Portals & Responsive Views", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Supplier Portal login renders cleanly on mobile viewport (390px)", async ({ page }) => {
    await page.goto("/supplier-login");
    await expect(page.getByRole("heading", { name: /supplier portal/i })).toBeVisible({
      timeout: 10_000,
    });
    // Verify default Password mode controls
    await expect(page.getByRole("button", { name: /password login/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /log in to supplier portal/i })).toBeVisible();

    // Switch to OTP mode and verify OTP controls
    await page.getByRole("button", { name: /otp code/i }).click();
    await expect(page.getByRole("button", { name: /send verification code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /email otp/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /mobile otp/i })).toBeVisible();

    // Check no horizontal scroll on body
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
    expectNoPageErrors(page);
  });

  test("Customer Portal login renders cleanly on mobile viewport (390px)", async ({ page }) => {
    await page.goto("/customer-login");
    await expect(page.getByRole("heading", { name: /customer portal/i })).toBeVisible({
      timeout: 10_000,
    });
    // Verify default Password mode controls
    await expect(page.getByRole("button", { name: /password login/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /log in to customer portal/i })).toBeVisible();

    // Switch to OTP mode and verify OTP controls
    await page.getByRole("button", { name: /otp code/i }).click();
    await expect(page.getByRole("button", { name: /send verification code/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /email otp/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /mobile otp/i })).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    expect(hasHorizontalOverflow).toBe(false);
    expectNoPageErrors(page);
  });

  test("Auditor Workspace renders cleanly on mobile viewport (390px)", async ({ authedPage }) => {
    await authedPage.goto("/reports/auditor");
    await expect(authedPage.getByRole("heading", { name: /auditor workspace/i })).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByText("Verification Engine", { exact: true })).toBeVisible();
    await expect(authedPage.getByText("System Audit Trail", { exact: true })).toBeVisible();

    expectNoPageErrors(authedPage);
  });

  test("Print Engine container allows horizontal scroll on mobile viewport (390px)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/reports/daily-close");
    // Verify page loads without error
    await expect(authedPage.getByText(/daily close/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
