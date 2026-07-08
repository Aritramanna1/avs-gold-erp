import { test, expect, expectNoPageErrors } from "../fixtures/base";
import { testCustomer } from "../data/test-data";

test.describe("Customers (People module — CRUD)", () => {
  test("create, find, edit and delete a customer", async ({ authedPage }) => {
    const customer = testCustomer();
    await authedPage.goto("/people");

    await authedPage.getByTestId("people-add-button").click();
    await authedPage.getByTestId("people-full-name").fill(customer.fullName);
    await authedPage.getByTestId("people-phone").fill(customer.phone);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    await authedPage
      .getByPlaceholder(/search/i)
      .first()
      .fill(customer.fullName);
    // Scoped to the list (tabpanel), not the whole page — the newly
    // created/selected record's name is also echoed in the detail sidebar.
    const row = authedPage.getByRole("tabpanel").getByText(customer.fullName, { exact: true });
    await expect(row).toHaveCount(1, { timeout: 10_000 });

    await row.first().click();
    await authedPage
      .getByTestId("people-selected-card")
      .getByRole("button", { name: /edit/i })
      .click();
    const updated = `${customer.fullName} Updated`;
    await authedPage.getByTestId("people-full-name").fill(updated);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByText(updated).first()).toBeVisible({ timeout: 10_000 });

    authedPage.once("dialog", (d) => d.accept());
    await authedPage.getByTestId("people-delete").first().click();
    await expect(authedPage.getByText(updated)).toHaveCount(0, { timeout: 10_000 });

    expectNoPageErrors(authedPage);
  });
});
