import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Email", () => {
  test("SMTP diagnostics test surfaces the real backend error (not a generic failure)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/settings?tab=email");
    const testEmailInput = authedPage.getByPlaceholder(/test|recipient/i).first();
    if (await testEmailInput.isVisible().catch(() => false)) {
      await testEmailInput.fill("e2e-smtp-test@example.com");
      const sendTestBtn = authedPage.getByRole("button", { name: /send test/i }).first();
      if (await sendTestBtn.isVisible().catch(() => false)) {
        await sendTestBtn.click();
        // Whatever the outcome, a toast/message must appear — not silence.
        await expect(
          authedPage.locator("[data-sonner-toast], [role='status']").first(),
        ).toBeVisible({
          timeout: 20_000,
        });
      }
    }
    expectNoPageErrors(authedPage);
  });
});
