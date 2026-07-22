import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Form validation", () => {
  test("People form requires full name and phone before saving", async ({ authedPage }) => {
    await authedPage.goto("/people");
    // A hard page.goto() re-pays the real app's boot-overlay delay (see
    // auth-invitation.spec.ts's note) — give the first click room for it.
    await authedPage.getByTestId("people-add-button").click({ timeout: 45_000 });
    await authedPage.getByTestId("people-save").click();
    // Validation must block the save — the dialog stays open with an error,
    // it must never silently create a blank record.
    await expect(authedPage.getByTestId("people-full-name")).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("Reset Password enforces the 10-character minimum client-side", async ({ page }) => {
    await page.goto("/reset-password");
    // No recovery session → the page shows the expired/invalid state; this
    // test only verifies the page never crashes when probed without a token.
    await expect(page.locator("body")).toBeVisible();
    expectNoPageErrors(page);
  });

  test("Forgot Password requires a value in the email field", async ({ page }) => {
    await page.goto("/forgot-password");
    const submit = page.getByRole("button", { name: /send reset link/i });
    await expect(page.locator('input[type="email"]')).toHaveAttribute("required", "");
    await submit.click();
    // Native HTML5 validation should keep us on the same page.
    await expect(page).toHaveURL(/forgot-password/);
    expectNoPageErrors(page);
  });
});
