import { test, expect, expectNoPageErrors, dismissWhatsNew } from "../fixtures/base";

test.describe("Licensing", () => {
  test("settings license page loads and shows current license status", async ({ authedPage }) => {
    await authedPage.goto("/settings/license");
    await dismissWhatsNew(authedPage);
    await expect(
      authedPage.getByRole("heading", { name: "License & Activation", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    // LicensePanel always renders these two <dt> labels regardless of
    // trial/active/expired/suspended state -- confirms the license store
    // resolved (not stuck on "checking") and the panel isn't blank/errored.
    await expect(authedPage.getByText("Status", { exact: true })).toBeVisible();
    await expect(authedPage.getByText("License Type", { exact: true })).toBeVisible();

    expectNoPageErrors(authedPage);
  });

  test("rejecting an invalid license key surfaces an activation error, not a silent pass", async ({
    authedPage,
  }) => {
    await authedPage.goto("/settings/license");
    await dismissWhatsNew(authedPage);
    await expect(
      authedPage.getByRole("heading", { name: "License & Activation", exact: true }),
    ).toBeVisible({ timeout: 15_000 });

    const keyInput = authedPage.locator('input[placeholder="XXXX-XXXX-XXXX-XXXX"], input[placeholder="Enter a new key to re-activate"]');
    await keyInput.fill("INVALID-LICENSE-KEY-0000-0000");

    const activateButton = authedPage.getByRole("button", { name: "Activate / Verify" });
    await activateButton.click();

    await expect(authedPage.getByText(/failed|invalid|error/i).first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
