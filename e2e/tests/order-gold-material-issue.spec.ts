import { test, expect } from "../fixtures/base";

test.describe("Gold / Material Issue workflow (from Production Order)", () => {
  test.skip("issuing gold from an order updates the Gold Ledger, Worker Gold Book, and Issue History; supports multiple issues (RC scope: Gold Issue removed from Orders — gold is now issued only via the Worker Gold Book, see routes/orders.$id.tsx)", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/orders/${seedIds.orderId}`);
    await expect(page.getByTestId("order-issue-gold-material")).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Gold / Material Issue workflow (Worker Gold Book — the only approved entry point)", () => {
  test("issuing material to a worker updates Gold Stock (vault), Worker Gold Book, and rejects over-issue", async ({
    authedPage: page,
  }) => {
    await page.goto("/workshop/gold-book");
    // Form fields persist as drafts (useDraft → localStorage) across runs —
    // clear this page's drafts so the form always starts in a known state
    // ("given" entry type, empty fields) regardless of a prior test run.
    await page.evaluate(() => {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith("mtj-goldbook-")) localStorage.removeItem(key);
      }
    });
    // Persisted cloud session metadata survives storageState reuse
    // across tests — force "online" so this run actually exercises the
    // execute_gold_transaction RPC path, not the offline/local-first one.
    await page.evaluate(async () => {
      const mod = await import(/* @vite-ignore */ "/src/lib/deployment-mode.ts");
      await mod.setDeploymentMode("online");
    });
    await page.reload();

    const beforeVault: number = await page.evaluate(async () => {
      const modPath = "/src/lib/ledger-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useLedger.getState().refresh();
      return mod.computeBalances(mod.useLedger.getState().entries).buckets.vault;
    });

    const beforeWgbCount: number = await page.evaluate(async () => {
      const modPath = "/src/lib/worker-gold-book-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useWorkerGoldBook.getState().refresh();
      return mod.useWorkerGoldBook.getState().entries.length;
    });

    await page.getByTestId("wgb-new-entry-tab").click();
    await page.getByTestId("wgb-worker-select").selectOption({ index: 1 });
    await page.getByTestId("wgb-particulars-select").selectOption("Wire");
    await page.getByTestId("wgb-gross-weight-input").fill("2");
    await page.getByTestId("wgb-submit-entry").click();

    // Real Gold Stock impact — this is the actual bug fix: issuing used to
    // write nothing to the vault at all.
    await expect(async () => {
      const afterVault: number = await page.evaluate(async () => {
        const modPath = "/src/lib/ledger-store.ts";
        const mod = await import(/* @vite-ignore */ modPath);
        await mod.useLedger.getState().refresh();
        return mod.computeBalances(mod.useLedger.getState().entries).buckets.vault;
      });
      expect(afterVault).toBe(beforeVault - 2000);
    }).toPass({ timeout: 10_000 });

    let afterWgbCount = 0;
    await expect(async () => {
      afterWgbCount = await page.evaluate(async () => {
        const modPath = "/src/lib/worker-gold-book-store.ts";
        const mod = await import(/* @vite-ignore */ modPath);
        await mod.useWorkerGoldBook.getState().refresh();
        return mod.useWorkerGoldBook.getState().entries.length;
      });
      expect(afterWgbCount).toBe(beforeWgbCount + 1);
    }).toPass({ timeout: 10_000 });

    // A successful submit switches the view to Daily Material Slips — go
    // back to the entry form for the over-issue attempt.
    await page.getByTestId("wgb-new-entry-tab").click();
    await page.getByTestId("wgb-worker-select").selectOption({ index: 1 });
    await page.getByTestId("wgb-particulars-select").selectOption("Wire");

    // Over-issue is rejected with a validation message, not a silent failure.
    await page.getByTestId("wgb-gross-weight-input").fill("999999");
    await page.getByTestId("wgb-submit-entry").click();
    await expect(page.getByText(/not enough gold stock/i)).toBeVisible({ timeout: 5_000 });

    const afterRejectedWgbCount: number = await page.evaluate(async () => {
      const modPath = "/src/lib/worker-gold-book-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useWorkerGoldBook.getState().refresh();
      return mod.useWorkerGoldBook.getState().entries.length;
    });
    expect(afterRejectedWgbCount).toBe(afterWgbCount);
  });
});
