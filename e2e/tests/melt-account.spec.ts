import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Melt Account", () => {
  test.skip("melt account page loads with gold operations view (RC scope: Melt Account gated to Coming Soon — see routes/melt.index.tsx)", async ({
    authedPage,
  }) => {
    await authedPage.goto("/melt");
    // getByText("Melt Account") is ambiguous — the sidebar nav link is also
    // literally "Melt Account" — getByRole("heading") targets only the
    // page's own <h1> title, unambiguously.
    await expect(
      authedPage.getByRole("heading", { name: "Melt Account", exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
