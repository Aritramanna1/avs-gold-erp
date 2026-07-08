import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Printing (A4 / Thermal / PDF)", () => {
  test("billing print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing/print/does-not-exist");
    await expect(authedPage.getByText(/invoice loading failure|could not be found/i)).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("people print route for an unknown id fails gracefully, not with a crash", async ({
    authedPage,
  }) => {
    await authedPage.goto("/people/print/does-not-exist");
    await expect(authedPage.getByText(/record not found|not found/i)).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });

  test("print routes render outside the ERP shell (no sidebar/nav chrome leaking into output)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/people/print/does-not-exist");
    // The app shell's sidebar/header must not be present on a print route.
    await expect(authedPage.locator("#user-menu-trigger")).toHaveCount(0);
  });
});
