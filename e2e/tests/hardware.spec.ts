import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Hardware page", () => {
  test("loads with sensible disconnected states (no blank/broken UI)", async ({ authedPage }) => {
    // A hard page.goto() re-pays the real app's boot-overlay delay (see
    // auth-invitation.spec.ts's note).
    await authedPage.goto("/hardware");
    await expect(authedPage.getByText("Hardware Management", { exact: true })).toBeVisible({
      timeout: 45_000,
    });
    // A disconnected scale must show a safe placeholder reading, not a crash.
    // Both the weight display ("— g") and the status line ("No reading yet")
    // render simultaneously — assert each individually rather than one
    // combined regex, since the combined form matches 2 elements at once
    // and trips Playwright's strict-mode single-match requirement.
    await expect(authedPage.getByText("— g", { exact: true })).toBeVisible();
    await expect(authedPage.getByText("No reading yet", { exact: true })).toBeVisible();
    expectNoPageErrors(authedPage);
  });

  test("no leftover scale-simulator controls are present", async ({ authedPage }) => {
    await authedPage.goto("/hardware");
    await expect(authedPage.getByRole("button", { name: /clear scale|simulate/i })).toHaveCount(0);
    expectNoPageErrors(authedPage);
  });
});
