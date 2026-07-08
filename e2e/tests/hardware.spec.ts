import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Hardware page", () => {
  test("loads with sensible disconnected states (no blank/broken UI)", async ({ authedPage }) => {
    await authedPage.goto("/hardware");
    await expect(authedPage.getByText("Hardware Management", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    // A disconnected scale must show a safe placeholder reading, not a crash.
    await expect(authedPage.getByText(/— g|no reading yet/i)).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("no leftover scale-simulator controls are present", async ({ authedPage }) => {
    await authedPage.goto("/hardware");
    await expect(authedPage.getByRole("button", { name: /clear scale|simulate/i })).toHaveCount(0);
    expectNoPageErrors(authedPage);
  });
});
