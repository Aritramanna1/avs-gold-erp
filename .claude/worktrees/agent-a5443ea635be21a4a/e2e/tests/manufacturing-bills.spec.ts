import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Manufacturing Bills", () => {
  test("manufacturing module loads with production lifecycle view", async ({ authedPage }) => {
    await authedPage.goto("/manufacturing");
    await expect(authedPage.getByText("Manufacturing", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
