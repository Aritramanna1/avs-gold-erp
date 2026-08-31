import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Customer Settlement Draft → Final Settlement Workflow", () => {
  test("draft creation, two-copy print, partial payment, final settlement generates GST Invoice", async ({
    authedPage,
  }) => {
    await authedPage.goto("/settlement/new");
    await expect(authedPage.getByTestId("settlement-customer-select")).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);

    await authedPage.getByTestId("settlement-customer-select").click();
    await authedPage.getByRole("option").first().click();
    await authedPage.getByTestId("settlement-gross-input").fill("10");
    await authedPage.getByTestId("settlement-create-submit").click();

    await expect(authedPage.getByTestId("settlement-financial-status")).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByTestId("settlement-financial-status")).toHaveText(
      "Pending Settlement",
    );
    await expect(authedPage.getByTestId("settlement-delivery-status")).toHaveText("Ready");
    expectNoPageErrors(authedPage);

    // ── Print Draft: two copies, front + back, DRAFT/NOT-A-TAX-INVOICE markers ──
    // Navigate directly to the print route rather than clicking the button —
    // the shared print-record UI intercepts that click into a generic
    // preview-modal iframe (Archival/Thermal/Tag tabs), an app-wide layer
    // unrelated to this settlement feature's own content.
    const settlementUrl = authedPage.url();
    const settlementId = settlementUrl.split("/settlement/")[1];
    await authedPage.goto(`/settlement/draft-print/${settlementId}`);
    // Widened to match observed reality — this is often the first navigation
    // to this specific route in a given dev-server process, so on top of the
    // refresh()/readAll() round trip to Supabase it can also incur Vite dev
    // mode's cold per-route compile (see playwright.config.ts's own comment
    // on this exact class of first-navigation latency).
    await expect(authedPage.getByTestId("settlement-draft-front")).toBeVisible({ timeout: 30_000 });
    await expect(authedPage.getByText("DRAFT SETTLEMENT").first()).toBeVisible();
    await expect(authedPage.getByText("NOT A TAX INVOICE").first()).toBeVisible();
    await expect(authedPage.getByText("CUSTOMER COPY").first()).toBeVisible();
    await expect(authedPage.getByText("WORKSHOP COPY").first()).toBeVisible();
    await expect(authedPage.getByTestId("settlement-draft-back")).toBeVisible();
    await expect(authedPage.getByText("Dealer Signature").first()).toBeVisible();
    await expect(authedPage.getByText("Employee Signature").first()).toBeVisible();
    // Internal manufacturing fields must never appear on the customer draft.
    for (const forbidden of ["KDM", "Recovery", "Scrap", "Manufacturing Cost", "Profit"]) {
      await expect(authedPage.getByText(forbidden, { exact: false })).toHaveCount(0);
    }
    expectNoPageErrors(authedPage);

    // ── Back to the settlement, mark delivered, record a partial cash payment ──
    await authedPage.goBack();
    await expect(authedPage.getByTestId("settlement-financial-status")).toBeVisible({
      timeout: 10_000,
    });

    await authedPage.getByTestId("settlement-delivery-delivered").click();
    await expect(authedPage.getByTestId("settlement-delivery-status")).toHaveText("Delivered");

    await authedPage.getByTestId("settlement-payment-amount").fill("500");
    await authedPage.getByTestId("settlement-record-payment").click();
    await expect(authedPage.getByText("₹500.00").first()).toBeVisible({ timeout: 10_000 });

    // ── Complete Final Settlement — irreversible, so it requires a confirm
    // step (Pilot Phase 2 review fix) before generating the GST Invoice ──
    await authedPage.getByTestId("settlement-complete-final").click();
    await authedPage
      .getByRole("alertdialog")
      .getByRole("button", { name: "Complete Final Settlement" })
      .click();
    await expect(authedPage.getByText(/GST Invoice .* generated/i).first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(authedPage.getByTestId("settlement-complete-final")).toBeHidden();

    expectNoPageErrors(authedPage);
  });
});
