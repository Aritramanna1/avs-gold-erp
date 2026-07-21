import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Inventory (Stock)", () => {
  test("stock page loads with finished jewellery/tag view", async ({ authedPage }) => {
    await authedPage.goto("/stock");
    // getByText("Stock") is ambiguous — the sidebar nav link is also
    // literally "Stock" — getByRole("heading") targets only the page's own
    // <h1> title, unambiguously.
    await expect(authedPage.getByRole("heading", { name: "Stock", exact: true })).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
