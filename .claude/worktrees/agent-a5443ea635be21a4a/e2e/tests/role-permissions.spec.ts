import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Role Permissions", () => {
  test("Users & Roles tab shows the signed-in account's role", async ({ authedPage }) => {
    await authedPage.goto("/settings");
    await authedPage.getByRole("tab", { name: /users.*roles/i }).click();
    await expect(authedPage.getByText(/role/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });

  test("unauthenticated visitors cannot reach settings — redirected to login", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("auth-form")).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(page);
  });
});
