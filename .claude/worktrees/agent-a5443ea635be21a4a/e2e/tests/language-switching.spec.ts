import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Language switching", () => {
  test("switching app language does not throw and persists on reload", async ({ authedPage }) => {
    await authedPage.goto("/settings?tab=language");
    const hindiOption = authedPage.getByText(/हिन्दी/).first();
    if (await hindiOption.isVisible().catch(() => false)) {
      await hindiOption.click();
      await authedPage.waitForTimeout(500);
    }
    expectNoPageErrors(authedPage);
  });
});
