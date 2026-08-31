/**
 * Deep live workflows: Billing → Vault → Verify → Print/PDF, Portal/KYC, OAuth callback shell.
 */
import { test, expect, type Page } from "../fixtures/base";
import { discoverInvoiceIdFromBilling, dismissCookies } from "../helpers/parity-live";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test.describe("Live workflow parity (5190)", () => {
  test.setTimeout(180_000);
  test.skip(() => process.env.E2E_LIVE_DATA !== "true", "Requires E2E_LIVE_DATA=true");

  test("vault material vault → billing list → print PDF chain", async ({ authedPage }) => {
    await authedPage.goto("/ledger", { waitUntil: "domcontentloaded" });
    await authedPage.getByTestId("tab-material-vault").click();
    await expect(authedPage.getByTestId("material-adjustment-open")).toBeVisible({
      timeout: 20_000,
    });

    const invoiceId = await discoverInvoiceIdFromBilling(authedPage);
    test.skip(!invoiceId, "No live invoice");

    await authedPage.goto(`/billing/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(authedPage.getByText(/invoice loading failure|couldn't load this section/i)).toHaveCount(
      0,
      { timeout: 20_000 },
    );

    await authedPage.goto(`/billing/print/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(authedPage.getByText(/invoice loading failure|couldn't load this section/i)).toHaveCount(
      0,
      { timeout: 20_000 },
    );
    await expect(authedPage.getByTestId("print-layout-root")).toBeVisible({ timeout: 30_000 });
    const [download] = await Promise.all([
      authedPage.waitForEvent("download", { timeout: 45_000 }),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("verify page accepts legacy AVS payload paste", async ({ page }) => {
    await page.goto("/verify", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    const input = page.getByTestId("verify-qr-input");
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("AVS|TEST|parity-probe|000000");
    await page.getByTestId("verify-submit").click();
    await page.waitForTimeout(2_000);
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(50);
    expect(body).not.toMatch(/something went wrong/i);
  });

  test("auth callback handles missing session gracefully", async ({ page }) => {
    await page.goto("/auth/callback", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await expect(page.getByText(/AVS Security Gateway|secure sign in|no active login/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("Google OAuth button starts redirect (mocked provider URL)", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    let oauthUrl: string | null = null;
    await page.route("**/auth/v1/authorize**", async (route) => {
      oauthUrl = route.request().url();
      await route.fulfill({ status: 200, body: "<html>oauth mock</html>" });
    });
    const googleBtn = page.getByRole("button", { name: /google|continue with google/i }).first();
    if (!(await googleBtn.isVisible().catch(() => false))) {
      test.skip(true, "Google OAuth not enabled in this build");
    }
    await googleBtn.click();
    await page.waitForTimeout(2_000);
    expect(oauthUrl ?? page.url()).toMatch(/google|authorize|oauth/i);
  });

  test("customer portal login + OTP mode toggle", async ({ page }) => {
    await page.goto("/customer-portal", { waitUntil: "domcontentloaded" });
    await dismissCookies(page);
    await expect(page.locator("body")).toBeVisible();
    const otpToggle = page.getByRole("button", { name: /mobile otp|otp/i });
    if (await otpToggle.isVisible().catch(() => false)) {
      await otpToggle.click();
      await expect(page.getByRole("button", { name: /send otp|verify/i }).first()).toBeVisible();
    }
  });

  test("KYC photo upload on existing live customer", async ({ authedPage }) => {
    await authedPage.goto("/people", { waitUntil: "domcontentloaded" });
    await authedPage.waitForTimeout(3_000);
    const customerTab = authedPage.getByRole("tab", { name: /^(Party \/ Grahak|Customers)\b/i });
    await customerTab.click();
    const firstRow = authedPage.getByRole("tabpanel").locator("tr, [role='row'], button").nth(1);
    if (!(await firstRow.isVisible().catch(() => false))) {
      test.skip(true, "No customer rows in live people list");
    }
    await firstRow.click();
    const photosBtn = authedPage.getByTestId("people-photos-files").first();
    await expect(photosBtn).toBeVisible({ timeout: 15_000 });
    await photosBtn.click();
    await authedPage.getByTestId("attachment-btn-photo").first().click();
    await authedPage.getByTestId("attachment-file-input").setInputFiles({
      name: "kyc-parity.png",
      mimeType: "image/png",
      buffer: PNG_1X1,
    });
    await expect(authedPage.getByTestId("attachment-preview")).toBeVisible({ timeout: 15_000 });
    await authedPage.getByTestId("attachment-save").click();
    await expect(authedPage.getByTestId("attachment-save")).toBeHidden({ timeout: 20_000 });
  });
});
