import { test, expect, expectNoPageErrors, dismissWhatsNew } from "../fixtures/base";

test.describe("Metal Conversion", () => {
  test("conversion page loads", async ({ authedPage }) => {
    await authedPage.goto("/conversion");
    await dismissWhatsNew(authedPage);
    await expect(
      authedPage.getByRole("heading", { name: "Metal Conversion", exact: true }),
    ).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("999 -> 916 conversion computes alloy and expected output from the active formula", async ({
    authedPage,
  }) => {
    await authedPage.goto("/conversion");
    await dismissWhatsNew(authedPage);
    await authedPage.getByRole("button", { name: "New Conversion" }).click();

    const dialog = authedPage.getByRole("dialog", { name: "New Metal Conversion" });
    await expect(dialog).toBeVisible();

    await dialog.getByText("Select", { exact: true }).first().click();
    await authedPage.getByRole("option", { name: "Gold · 24K / 999" }).click();

    await dialog.getByText("Select", { exact: true }).first().click();
    await authedPage.getByRole("option", { name: "Gold · 22K / 916" }).click();

    await dialog.getByPlaceholder("0.000").first().fill("100");

    // DEFAULT_ALLOY_FORMULAS af_999_916: alloyRatioMgPer1000 = 90, expectedLossPct = 1
    // input 100g fine = 100000mg -> alloy = 100000 * 90 / 1000 = 9000mg,
    // expected output = 100000 * (1 - 1/100) = 99000mg = 99 g
    await expect(dialog.getByText(/Calculated Alloy \(mg\)/)).toBeVisible();
    const alloyInput = dialog.locator('input[readonly]');
    await expect(alloyInput).toHaveValue("9000");
    await expect(dialog.getByText(/Expected output:/)).toContainText("99.000 g");
  });
});
