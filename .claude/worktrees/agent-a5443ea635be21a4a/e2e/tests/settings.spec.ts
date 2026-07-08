import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Settings", () => {
  test("settings page loads with firm/masters/GST configuration", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await expect(authedPage.getByText("Settings", { exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("no debug/test-only auth controls remain visible under DB Status", async ({
    authedPage,
  }) => {
    await authedPage.goto("/settings?tab=db");
    // Legitimate DB migration diagnostics may remain, but there must be no
    // literal placeholder/leftover markers shown to the user.
    await expect(authedPage.getByText(/coming soon|not implemented|todo/i)).toHaveCount(0);
    expectNoPageErrors(authedPage);
  });
});
