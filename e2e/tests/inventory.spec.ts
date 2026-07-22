import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Inventory (Stock)", () => {
  test("stock page loads with finished jewellery/tag view", async ({ authedPage }) => {
    await authedPage.goto("/stock");
    // getByText("Stock") is ambiguous — the sidebar nav link is also
    // literally "Stock" — getByRole("heading") targets only the page's own
    // <h1> title, unambiguously.
    // A hard page.goto() re-pays the real app's boot-overlay delay (see
    // auth-invitation.spec.ts's note).
    await expect(authedPage.getByRole("heading", { name: "Ready Stock", exact: true })).toBeVisible(
      {
        timeout: 45_000,
      },
    );
    expectNoPageErrors(authedPage);
  });
});
