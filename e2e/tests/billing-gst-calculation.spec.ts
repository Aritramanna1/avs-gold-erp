import { test, expect } from "../fixtures/base";

/**
 * Billing & Printing audit — GST calculation correctness. Regression
 * coverage for a real bug found during the audit: CGST and SGST were each
 * rounded independently (Math.round(base*halfRate/100) twice), which can
 * produce cgst+sgst != the mathematically correct single-rate total by a
 * paise. Fixed in computeInvoiceTotals (billing-store.ts) to round the
 * total once and split it, guaranteeing the two halves always sum exactly.
 *
 * These tests read/mutate the app's real settings-store and billing-store
 * singletons via window.__settingsStore/__billingStore (exposed in DEV
 * builds by __root.tsx), NOT a separate `/* @vite-ignore *\/ import("/src/lib/...")`
 * of the same file by raw path — that pattern silently created a SECOND,
 * independent module instance (its own Zustand store) in Vite dev mode, so
 * a test's setState() never reached the instance computeInvoiceTotals
 * actually reads from. That bug made the IGST-mode test below fail against
 * stale default config while looking like a real product defect.
 */
function fakeItem(makingChargesPaise: number): Record<string, unknown> {
  return {
    id: "it1",
    itemName: "Test",
    category: "Ring",
    purity: 916,
    grossMg: 1000,
    netMg: 1000,
    fineMg: 916,
    goldRatePerGramPaise: 0,
    goldValuePaise: 0,
    makingChargesPaise,
    stoneChargesPaise: 0,
    otherChargesPaise: 0,
    discountPaise: 0,
    lineTotalPaise: makingChargesPaise,
  };
}

// Waits for the DEV-only window.__settingsStore/__billingStore hooks that
// __root.tsx attaches asynchronously on app boot.
async function waitForHooks(page: import("@playwright/test").Page): Promise<void> {
  await page.waitForFunction(
    () => !!(window as any).__settingsStore && !!(window as any).__billingStore,
  );
}

test.describe("Billing — GST calculation correctness", () => {
  test("CGST + SGST always exactly equals the total GST (no independent-rounding drift)", async ({
    authedPage: page,
  }) => {
    await waitForHooks(page);
    // base=10100 paise @ 3% previously produced cgst+sgst=304 vs the
    // correct total of 303 — the exact real-world mismatch this bug caused.
    const result = await page.evaluate((item) => {
      const w = window as any;
      w.__settingsStore.useSettings.setState((s: any) => ({
        gst: { ...s.gst, gstRatePct: 3, applyOnMakingAndStoneOnly: true, splitMode: "cgst_sgst" },
      }));
      return w.__billingStore.computeInvoiceTotals([item as any], "gst3", undefined, []);
    }, fakeItem(10100));

    expect(result.cgstPaise + result.sgstPaise).toBe(result.gstPaise);
    expect(result.gstPaise).toBe(303);
    expect(Math.abs(result.cgstPaise - result.sgstPaise)).toBeLessThanOrEqual(1);
  });

  test("the cgst+sgst===gstPaise invariant holds across a full sweep of base values", async ({
    authedPage: page,
  }) => {
    await waitForHooks(page);
    const sweep = await page.evaluate(() => {
      const w = window as any;
      const results: boolean[] = [];
      for (let base = 1; base <= 2000; base += 37) {
        const item: any = {
          id: "i",
          itemName: "t",
          category: "c",
          purity: 916,
          grossMg: 1,
          netMg: 1,
          fineMg: 1,
          goldRatePerGramPaise: 0,
          goldValuePaise: 0,
          makingChargesPaise: base,
          stoneChargesPaise: 0,
          otherChargesPaise: 0,
          discountPaise: 0,
          lineTotalPaise: base,
        };
        const r = w.__billingStore.computeInvoiceTotals([item], "gst3", undefined, []);
        results.push(r.cgstPaise + r.sgstPaise === r.gstPaise);
      }
      return results;
    });
    expect(sweep.every(Boolean)).toBe(true);
  });

  test("IGST mode stores the full tax as a single pool (cgst=0, sgst=full amount)", async ({
    authedPage: page,
  }) => {
    await waitForHooks(page);
    const result = await page.evaluate((item) => {
      const w = window as any;
      w.__settingsStore.useSettings.setState((s: any) => ({
        gst: { ...s.gst, gstRatePct: 3, applyOnMakingAndStoneOnly: true, splitMode: "igst" },
      }));
      return w.__billingStore.computeInvoiceTotals([item as any], "gst3", undefined, []);
    }, fakeItem(10100));

    expect(result.cgstPaise).toBe(0);
    expect(result.sgstPaise).toBe(303);
  });
});
