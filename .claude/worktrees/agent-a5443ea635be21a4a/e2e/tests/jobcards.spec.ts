import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Job Cards (Workshop)", () => {
  test("workshop board loads with job-card sections and no console errors", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop");
    await expect(authedPage.getByText("Workshop", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
