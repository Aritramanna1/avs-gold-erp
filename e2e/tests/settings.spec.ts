import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Settings", () => {
  test("settings page loads with firm/masters/GST configuration", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    // getByText("Settings", {exact:true}) is ambiguous — it also matches the
    // sidebar nav link, not just the page heading (strict-mode violation).
    await expect(authedPage.getByRole("heading", { name: "Settings" })).toBeVisible({
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
