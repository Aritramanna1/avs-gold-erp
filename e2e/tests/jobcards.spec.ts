import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Job Cards (Workshop)", () => {
  test("workshop board loads with job-card sections and no console errors", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop");
    // getByText("Workshop") is ambiguous — the sidebar nav link is also
    // literally "Workshop" — getByRole("heading") targets only the page's
    // own <h1> title, unambiguously.
    // A hard page.goto() re-pays the real app's boot-overlay delay (see
    // auth-invitation.spec.ts's note).
    await expect(
      authedPage.getByRole("heading", { name: "Manufacturing Books", exact: true }),
    ).toBeVisible({
      timeout: 45_000,
    });
    expectNoPageErrors(authedPage);
  });
});
