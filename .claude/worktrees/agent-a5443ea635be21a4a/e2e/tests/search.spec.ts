import { test, expect, expectNoPageErrors } from "../fixtures/base";
import { testCustomer } from "../data/test-data";

test.describe("Search", () => {
  test("People search filters the list to matching records only", async ({ authedPage }) => {
    const customer = testCustomer();
    await authedPage.goto("/people");
    await authedPage.getByTestId("people-add-button").click();
    await authedPage.getByTestId("people-full-name").fill(customer.fullName);
    await authedPage.getByTestId("people-phone").fill(customer.phone);
    await authedPage.getByTestId("people-save").click();
    await expect(authedPage.getByTestId("people-full-name")).toBeHidden({ timeout: 10_000 });

    // Scoped to the list (tabpanel), not the whole page — the newly
    // created/selected record's name is also echoed in the detail sidebar.
    const listMatch = authedPage.getByRole("tabpanel").getByText(customer.fullName, { exact: true });
    const search = authedPage.getByPlaceholder(/search/i).first();
    await search.fill(customer.fullName);
    await expect(listMatch).toBeVisible({ timeout: 10_000 });

    await search.fill("zzz_no_such_record_zzz");
    await expect(listMatch).toBeHidden();

    expectNoPageErrors(authedPage);
  });
});
