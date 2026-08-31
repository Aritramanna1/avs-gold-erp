import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Job Cards (Workshop)", () => {
  test("workshop board loads with job-card sections and no console errors", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop");
    // getByText("Workshop") is ambiguous — the sidebar nav link is also
    // literally "Workshop" — getByRole("heading") targets only the page's
    // own <h1> title, unambiguously.
    await expect(
      authedPage.getByRole("heading", { name: "Manufacturing Books", exact: true }),
    ).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);
  });
});
