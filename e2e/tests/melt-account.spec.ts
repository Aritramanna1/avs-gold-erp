import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Melt Account", () => {
  test("melt account page loads with gold operations view", async ({ authedPage }) => {
    await authedPage.goto("/melt");
    // getByText("Melt Account") is ambiguous — the sidebar nav link is also
    // literally "Melt Account" — getByRole("heading") targets only the
    // page's own <h1> title, unambiguously.
    await expect(
      authedPage.getByRole("heading", { name: /Melt Account|Melting Process/i }),
    ).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
