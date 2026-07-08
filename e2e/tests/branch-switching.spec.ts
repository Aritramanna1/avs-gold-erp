import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Branch Switching", () => {
  test("branch indicator is visible and switching (if permitted) doesn't throw", async ({
    authedPage,
  }) => {
    await authedPage.goto("/");
    const branchContainer = authedPage.locator("#branch-selector-container");
    await expect(branchContainer).toBeVisible({ timeout: 15_000 });

    const dropdownTrigger = branchContainer.locator("button, [role='button']").first();
    const isSwitchable = await dropdownTrigger
      .evaluate((el) => el.closest("[data-state]") !== null)
      .catch(() => false);

    if (isSwitchable) {
      await dropdownTrigger.click();
      const items = authedPage.locator('[id^="branch-select-item-"]');
      if ((await items.count()) > 1) {
        await items.nth(1).click();
      }
    }
    expectNoPageErrors(authedPage);
  });
});
