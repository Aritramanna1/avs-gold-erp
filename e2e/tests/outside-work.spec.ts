import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Outside Work (External Jeweller) workflow — issues gold to the seeded
 * outside jeweller, receives finished product back, and verifies the
 * Outside Work Ledger's Current Position updates and supports multiple
 * issue/return cycles, exactly mirroring worker-return.spec.ts's shape.
 */
test.describe("Outside Work", () => {
  test("issue then receive from outside jeweller updates Current Position, and supports multiple cycles", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop/outside-work");
    await expect(authedPage.getByText("Outside Work").first()).toBeVisible({ timeout: 15_000 });
    expectNoPageErrors(authedPage);

    // Wait for the async local-first readAll() to settle before taking a
    // baseline — the jeweller select + history list can render before that
    // refresh() promise resolves, which would otherwise race the count below.
    await authedPage.waitForFunction(
      () => {
        const combo = document.querySelector('[data-testid="outside-work-jeweller-filter"]');
        return !!combo && combo.textContent && combo.textContent.trim().length > 0;
      },
      { timeout: 15_000 },
    );
    await authedPage.waitForTimeout(500);

    // Baseline counts — this jeweller's ledger persists across test runs
    // (real Supabase rows, no per-test reset), so cycles are asserted as
    // deltas from whatever is already on screen, not fixed absolute counts.
    const issuedItems = authedPage.locator("li", { hasText: "Issued · Gold ·" });
    const receivedItems = authedPage.locator("li", { hasText: "Received ·" });
    const baselineIssued = await issuedItems.count();
    const baselineReceived = await receivedItems.count();

    // ── Cycle 1: issue gold, then receive a finished product back ───────
    await authedPage.getByTestId("outside-work-issue-btn").click();
    await authedPage.getByTestId("outside-issue-jeweller-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("outside-issue-weight-input").fill("10");
    await authedPage.getByTestId("outside-issue-submit").click();
    await expect(authedPage.getByTestId("outside-issue-submit")).toBeHidden({ timeout: 10_000 });

    await authedPage.getByTestId("outside-work-receive-btn").click();
    await authedPage.getByTestId("outside-receive-jeweller-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("outside-receive-weight-input").fill("6");
    await expect(authedPage.getByTestId("outside-receive-submit")).toBeEnabled({ timeout: 5_000 });
    await authedPage.getByTestId("outside-receive-submit").click();
    await expect(authedPage.getByTestId("outside-receive-submit")).toBeHidden({ timeout: 10_000 });

    await expect(authedPage.getByText("Transaction History")).toBeVisible();
    await expect(authedPage.getByText(/no transactions recorded yet/i)).toBeHidden();

    // ── Cycle 2: a second issue + receive against the SAME jeweller ─────
    await authedPage.getByTestId("outside-work-issue-btn").click();
    await authedPage.getByTestId("outside-issue-jeweller-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("outside-issue-weight-input").fill("5");
    await authedPage.getByTestId("outside-issue-submit").click();
    await expect(authedPage.getByTestId("outside-issue-submit")).toBeHidden({ timeout: 10_000 });

    await authedPage.getByTestId("outside-work-receive-btn").click();
    await authedPage.getByTestId("outside-receive-jeweller-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("outside-receive-weight-input").fill("5");
    await expect(authedPage.getByTestId("outside-receive-submit")).toBeEnabled({ timeout: 5_000 });
    await authedPage.getByTestId("outside-receive-submit").click();
    await expect(authedPage.getByTestId("outside-receive-submit")).toBeHidden({ timeout: 10_000 });

    // Two issues and two receives must both be listed (multiple cycles supported).
    await expect(issuedItems).toHaveCount(baselineIssued + 2, { timeout: 10_000 });
    await expect(receivedItems).toHaveCount(baselineReceived + 2, { timeout: 10_000 });

    expectNoPageErrors(authedPage);
  });

  test("labour charge, payment, and settlement update Labour Earned/Paid/Outstanding correctly", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop/outside-work");
    await expect(authedPage.getByText("Outside Work").first()).toBeVisible({ timeout: 15_000 });
    await authedPage.waitForFunction(
      () => {
        const combo = document.querySelector('[data-testid="outside-work-jeweller-filter"]');
        return !!combo && combo.textContent && combo.textContent.trim().length > 0;
      },
      { timeout: 15_000 },
    );
    await authedPage.waitForTimeout(500);
    expectNoPageErrors(authedPage);

    // ── Labour Charge: bill ₹1000 flat with no GST ───────────────────────
    await authedPage.getByTestId("outside-work-labour-btn").click();
    await authedPage.getByTestId("outside-labour-amount-input").fill("1000");
    await authedPage.getByTestId("outside-labour-submit").click();
    await expect(authedPage.getByTestId("outside-labour-submit")).toBeHidden({ timeout: 10_000 });

    // Labour Charges list must show the new bill.
    await expect(authedPage.getByText(/₹1,000\.00/).first()).toBeVisible({ timeout: 10_000 });

    // ── Payment: pay ₹400 partial ────────────────────────────────────────
    await authedPage.getByTestId("outside-work-payment-btn").click();
    await authedPage.getByTestId("outside-payment-amount-input").fill("400");
    await authedPage.getByTestId("outside-payment-submit").click();
    await expect(authedPage.getByTestId("outside-payment-submit")).toBeHidden({ timeout: 10_000 });

    await expect(authedPage.getByText(/₹400\.00 · cash/).first()).toBeVisible({ timeout: 10_000 });

    // ── Settlement: settle the remaining labour outstanding ──────────────
    await authedPage.getByTestId("outside-work-settlement-btn").click();
    await authedPage.getByTestId("outside-settlement-labour-tab").click();
    await expect(authedPage.getByTestId("outside-settlement-labour-submit")).toBeEnabled({
      timeout: 5_000,
    });
    await authedPage.getByTestId("outside-settlement-labour-submit").click();
    await expect(authedPage.getByTestId("outside-settlement-labour-submit")).toBeHidden({
      timeout: 10_000,
    });

    // After settling the full remaining outstanding, Labour Outstanding must read ₹0.00.
    const outstandingBlock = authedPage.getByText("Labour Outstanding").locator("..");
    await expect(outstandingBlock).toContainText("₹0.00", { timeout: 10_000 });

    expectNoPageErrors(authedPage);
  });

  test("statement generation downloads a PDF for the selected outside jeweller", async ({
    authedPage,
  }) => {
    await authedPage.goto("/workshop/outside-work");
    await expect(authedPage.getByText("Outside Work").first()).toBeVisible({ timeout: 15_000 });
    await authedPage.waitForFunction(
      () => {
        const combo = document.querySelector('[data-testid="outside-work-jeweller-filter"]');
        return !!combo && combo.textContent && combo.textContent.trim().length > 0;
      },
      { timeout: 15_000 },
    );
    expectNoPageErrors(authedPage);

    await authedPage.getByTestId("outside-work-statement-btn").click();
    await authedPage.getByTestId("outside-statement-kind-select").click();
    await authedPage.getByRole("option", { name: "Outstanding Statement" }).click();

    const downloadPromise = authedPage.waitForEvent("download");
    await authedPage.getByTestId("outside-statement-generate").click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.pdf$/);

    expectNoPageErrors(authedPage);
  });
});
