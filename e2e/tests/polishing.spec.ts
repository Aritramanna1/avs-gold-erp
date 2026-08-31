import { test, expect } from "../fixtures/base";

async function snapshot(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    // @ts-expect-error dynamic runtime import path, no type declarations
    const ledgerMod = await import(/* @vite-ignore */ "/src/lib/ledger-store.ts");
    // @ts-expect-error dynamic runtime import path, no type declarations
    const supabaseMod = await import(/* @vite-ignore */ "/src/integrations/supabase/client.ts");
    await ledgerMod.useLedger.getState().refresh();
    const balances = ledgerMod.computeBalances(ledgerMod.useLedger.getState().entries);
    const { data } = await supabaseMod
      .getSupabaseClient()
      .from("polishing_transactions")
      .select("data");
    const rows = (data ?? []).map((r: any) => r.data);
    return {
      vault: balances.buckets.vault,
      karigar: balances.buckets.karigar,
      finished: balances.buckets.finished,
      ledgerCount: ledgerMod.useLedger.getState().entries.length,
      polishingTxnCount: rows.length,
    };
  });
}

test.describe("Polishing workflow", () => {
  test.skip("Send to Polishing then Receive from Polishing synchronizes Gold Ledger, Polishing Ledger, and the linked order's timeline exactly once each (RC scope: Polishing disabled by default — see business-rules-registry.ts enable_polishing_module)", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/orders/${seedIds.orderId}`);
    await expect(page.getByTestId("order-send-polishing")).toBeVisible({ timeout: 15_000 });

    const before = await snapshot(page);

    // Send to Polishing
    await page.getByTestId("order-send-polishing").click();
    await page.getByTestId("polishing-send-polisher-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("polishing-send-product-input").fill("E2E test bangle");
    await page.getByTestId("polishing-send-weight-input").fill("5");
    await page.getByTestId("polishing-send-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    await expect(page.getByText("Sent to Polishing", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByTestId("order-polishing-history-list").getByText(/Sent · E2E test bangle/),
    ).toBeVisible();

    // Receive from Polishing
    await page.getByTestId("order-receive-polishing").click();
    await page.getByTestId("polishing-receive-polisher-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("polishing-receive-product-input").fill("E2E test bangle, polished");
    await page.getByTestId("polishing-receive-weight-input").fill("4.98");
    await page.getByTestId("polishing-receive-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    await expect(page.getByText("Received from Polishing", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page
        .getByTestId("order-polishing-history-list")
        .getByText(/Received · E2E test bangle, polished/),
    ).toBeVisible();

    const after = await snapshot(page);

    // Gold Ledger tracks fine gold (gross × purity ÷ 999).
    const expectedFine = await page.evaluate(async () => {
      // @ts-expect-error dynamic runtime import path, no type declarations
      const goldMod = await import(/* @vite-ignore */ "/src/lib/gold.ts");
      return {
        sentFineMg: goldMod.fineGoldMg(5000, 916),
        receivedFineMg: goldMod.fineGoldMg(4980, 916),
      };
    });

    // Send: vault -fine, karigar +fine. Receive: karigar -fine, finished +fine.
    expect(after.vault).toBe(before.vault - expectedFine.sentFineMg);
    expect(after.karigar).toBe(
      before.karigar + expectedFine.sentFineMg - expectedFine.receivedFineMg,
    );
    expect(after.finished).toBe(before.finished + expectedFine.receivedFineMg);

    // Exactly 2 new Gold Ledger entries (sent_to_polisher + received_from_polisher) — no duplicates.
    expect(after.ledgerCount).toBe(before.ledgerCount + 2);

    // Exactly 2 new Polishing Ledger transactions (sent + received) — no duplicates.
    expect(after.polishingTxnCount).toBe(before.polishingTxnCount + 2);
  });

  test.skip("Polishing Ledger page shows grouped Current Position and per-polisher summary (RC scope: Polishing disabled by default — see business-rules-registry.ts enable_polishing_module)", async ({
    authedPage: page,
  }) => {
    await page.goto("/workshop/polishing");
    await expect(page.getByTestId("polishing-send-btn")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Gold Sent")).toBeVisible();
    await expect(page.getByText("Gold Returned")).toBeVisible();
    await expect(page.getByText("Pending Gold")).toBeVisible();
    await expect(page.getByText("Pending Jobs")).toBeVisible();
    await expect(page.getByText("Last Activity")).toBeVisible();
    await expect(page.getByText("Polishing Ledger — by Polisher")).toBeVisible();
  });

  test.skip("Sending to Polishing from the standalone Polishing page can link a Production Order and still updates that order's timeline (RC scope: Polishing disabled by default — see business-rules-registry.ts enable_polishing_module)", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto("/workshop/polishing");
    await page.getByTestId("polishing-send-btn").click();
    await expect(page.getByTestId("polishing-send-order-select")).toBeVisible({ timeout: 10_000 });

    await page.getByTestId("polishing-send-order-select").click();
    await page.getByRole("option", { name: new RegExp(`^${seedIds.orderNo}\\s·`) }).click();
    await page.getByTestId("polishing-send-polisher-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("polishing-send-product-input").fill("E2E standalone-linked item");
    await page.getByTestId("polishing-send-weight-input").fill("2");
    await page.getByTestId("polishing-send-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Verify directly against the seeded order's live in-memory state rather
    // than navigating and re-rendering the order page — this avoids any
    // race with a real, concurrently-written-to database re-ordering which
    // row a fresh page load happens to see first, and checks exactly what
    // matters: did picking this order in the standalone dialog produce (a)
    // a polishing_transactions row with this orderId, and (b) a timeline
    // entry on this exact order.
    const result = await page.evaluate(async (orderId) => {
      // @ts-expect-error dynamic runtime import path, no type declarations
      const ordersMod = await import(/* @vite-ignore */ "/src/lib/orders-store.ts");
      // @ts-expect-error dynamic runtime import path, no type declarations
      const supabaseMod = await import(/* @vite-ignore */ "/src/integrations/supabase/client.ts");
      await ordersMod.useOrders.getState().refresh();
      const order = ordersMod.useOrders.getState().orders.find((o: any) => o.id === orderId);
      const { data } = await supabaseMod
        .getSupabaseClient()
        .from("polishing_transactions")
        .select("data")
        .eq("data->>orderId", orderId)
        .eq("data->>product", "E2E standalone-linked item");
      return {
        timelineHasEntry: !!order?.timeline?.some((t: any) => t.label === "Sent to Polishing"),
        polishingRowsForOrder: (data ?? []).length,
      };
    }, seedIds.orderId);

    // Exactly one row for THIS specific send (other tests in this file may
    // have also linked the same seeded order against a different product).
    expect(result.polishingRowsForOrder).toBe(1);
    expect(result.timelineHasEntry).toBe(true);
  });
});
