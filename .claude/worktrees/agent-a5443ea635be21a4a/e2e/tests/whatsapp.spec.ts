import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("WhatsApp", () => {
  test("Communications & CRM hub loads without console errors", async ({ authedPage }) => {
    await authedPage.goto("/communications");
    await expect(authedPage.getByText("Communications & CRM", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("WhatsApp provider settings load in Settings → Communications", async ({ authedPage }) => {
    await authedPage.goto("/settings/communications");
    await expect(authedPage.getByText(/whatsapp/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
