import { test, expect, expectNoPageErrors } from "../fixtures/base";

test.describe("Customer Settlement & GST Billing", () => {
  test("Customer Settlement Slip prints only customer-facing fields for a real invoice", async ({
    authedPage,
    seedIds,
  }) => {
    await authedPage.goto(`/billing/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("billing-print-settlement-slip")).toBeVisible({
      timeout: 15_000,
    });
    expectNoPageErrors(authedPage);

    // Navigate directly to the print route rather than through the
    // PrintDialog/iframe (that dialog's iframe mount timing is an
    // implementation detail of a shared, pre-existing component, not
    // something this feature should couple its own test to).
    await authedPage.goto(`/billing/settlement-slip/${seedIds.invoiceId}`);
    await expect(authedPage.getByTestId("settlement-slip-doc")).toBeVisible({ timeout: 15_000 });
    await expect(authedPage.getByText("Previous Gold Balance")).toBeVisible();
    await expect(authedPage.getByText("Gold Rate Used")).toBeVisible();
    await expect(authedPage.getByText("Closing Settlement")).toBeVisible();

    // Must NEVER show internal manufacturing fields on a customer document.
    for (const forbidden of [
      "Manufacturing Cost",
      "Worker Labour",
      "Outside Labour",
      "Overloss",
      "Recovery",
      "Internal Profit",
    ]) {
      await expect(authedPage.getByText(forbidden, { exact: false })).toHaveCount(0);
    }

    expectNoPageErrors(authedPage);
  });

  test("TCS applies above the configured threshold, computed via computeInvoiceTotals", async ({
    authedPage,
  }) => {
    await authedPage.goto("/billing");
    await expect(authedPage.getByText("Billing", { exact: true })).toBeVisible({ timeout: 15_000 });

    await authedPage.waitForFunction(
      () => !!(window as any).__settingsStore && !!(window as any).__billingStore,
    );

    const result = await authedPage.evaluate(async () => {
      // Uses the app's real settings-store/billing-store singletons (exposed
      // by __root.tsx in DEV builds), NOT a separate raw-path dynamic
      // import — that pattern silently creates a second, independent module
      // instance in Vite dev mode, so setGst() below would never reach the
      // instance computeInvoiceTotals actually reads from.
      const settingsMod = (window as any).__settingsStore;
      const billingMod = (window as any).__billingStore;

      const before = settingsMod.useSettings.getState().gst;
      settingsMod.useSettings.getState().setGst({
        tcsEnabled: true,
        tcsThresholdPaise: 100000, // ₹1,000 — deliberately low so the test invoice crosses it
        tcsRatePct: 1,
        allowGstPaymentInGold: true,
        gstGoldConversionRatePaise: 500000, // ₹5,000/g
      });

      const item = {
        id: "it1",
        itemName: "Test Ring",
        category: "Ring",
        purity: 916,
        grossMg: 10000,
        netMg: 10000,
        fineMg: 9160,
        goldRatePerGramPaise: 600000,
        goldValuePaise: 5497600,
        makingChargesPaise: 100000,
        stoneChargesPaise: 0,
        hallmarkChargesPaise: 0,
        otherChargesPaise: 0,
        discountPaise: 0,
        lineTotalPaise: 5597600,
      };
      const totals = billingMod.computeInvoiceTotals([item], "none");

      // Restore original settings so this test doesn't leak config into others.
      settingsMod.useSettings.getState().setGst(before);

      return totals;
    });

    // subtotal (5,597,600) + gst (0, gst="none") = 5,597,600 > threshold (100,000) → TCS at 1%.
    expect(result.tcsPaise).toBe(Math.round(5597600 * 0.01));
    expect(result.grandTotalPaise).toBe(5597600 + result.tcsPaise);

    expectNoPageErrors(authedPage);
  });
});
