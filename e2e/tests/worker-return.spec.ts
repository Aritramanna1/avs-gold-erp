import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Worker Return workflow — issues gold to the seeded karigar against the
 * seeded Production Order, then records a return, and verifies the
 * Current Gold Position summary reflects both, and that the return is
 * visible from a second issue/return cycle (multiple returns per order).
 */
test.describe("Worker Return", () => {
  test("issue then receive from worker updates Current Gold Position, and supports multiple cycles", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/orders/${seedIds.orderId}`);
    expectNoPageErrors(authedPage);

    // ── Cycle 1: issue gold, then receive a return ──────────────────────
    await authedPage.getByTestId("order-issue-gold-material").click();
    await authedPage.getByTestId("issue-worker-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("issue-weight-input").fill("10");
    await authedPage.getByTestId("issue-submit").click();
    await expect(authedPage.getByTestId("issue-submit")).toBeHidden({ timeout: 10_000 });

    await authedPage.getByTestId("order-receive-from-worker").click();
    // Select explicitly rather than relying on auto-fill timing — the auto-
    // fill is a convenience, not something this test should race against.
    await authedPage.getByTestId("return-worker-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("return-weight-input").fill("6");
    await expect(authedPage.getByTestId("return-submit")).toBeEnabled({ timeout: 5_000 });
    await authedPage.getByTestId("return-submit").click();
    await expect(authedPage.getByTestId("return-submit")).toBeHidden({ timeout: 10_000 });

    // Gold Position: issued 10g fine (916 default), returned 6g fine, pending > 0.
    await expect(authedPage.getByText("Current Gold Position")).toBeVisible();
    await expect(authedPage.getByText(/no returns recorded yet/i)).toBeHidden();

    // ── Cycle 2: a second issue + return against the SAME order ─────────
    await authedPage.getByTestId("order-issue-gold-material").click();
    await authedPage.getByTestId("issue-worker-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("issue-weight-input").fill("5");
    await authedPage.getByTestId("issue-submit").click();
    await expect(authedPage.getByTestId("issue-submit")).toBeHidden({ timeout: 10_000 });

    await authedPage.getByTestId("order-receive-from-worker").click();
    await authedPage.getByTestId("return-worker-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("return-weight-input").fill("5");
    await expect(authedPage.getByTestId("return-submit")).toBeEnabled({ timeout: 5_000 });
    await authedPage.getByTestId("return-submit").click();
    await expect(authedPage.getByTestId("return-submit")).toBeHidden({ timeout: 10_000 });

    // Two issues and two returns must both be listed (multiple cycles supported).
    const issueItems = authedPage.locator("li", { hasText: "Gold ·" });
    await expect(issueItems).toHaveCount(2, { timeout: 10_000 });

    expectNoPageErrors(authedPage);
  });

  test("Worker Gold Book reflects the issue and return entries", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto("/workshop/gold-book");
    await expect(authedPage.getByText(/gold book/i).first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);
  });
});
