import { test, expect, expectNoPageErrors, dismissWhatsNew } from "../fixtures/base";

test.describe("Licensing", () => {
  test("settings license page loads and shows current license status", async ({ authedPage }) => {
    await authedPage.goto("/settings/license");
    await dismissWhatsNew(authedPage);
    await expect(authedPage).toHaveURL(/\/settings\/license/);
    await expect(authedPage.getByRole("heading", { name: /Subscription|License/i })).toBeVisible({
      timeout: 15_000,
    });

    await expect(
      authedPage.getByTestId("tenant-billing-centre"),
    ).toBeVisible({ timeout: 15_000 });

    expectNoPageErrors(authedPage);
  });
});
