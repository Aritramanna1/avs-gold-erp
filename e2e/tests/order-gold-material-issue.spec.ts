import { test, expect } from "../fixtures/base";

test.describe("Gold / Material Issue workflow (from Production Order)", () => {
  test("issuing gold from an order updates the Gold Ledger, Worker Gold Book, and Issue History; supports multiple issues", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/orders/${seedIds.orderId}`);
    await expect(page.getByTestId("order-issue-gold-material")).toBeVisible({ timeout: 15_000 });

    const beforeVault: number = await page.evaluate(async () => {
      const modPath = "/src/lib/ledger-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useLedger.getState().refresh();
      const balances = mod.computeBalances(mod.useLedger.getState().entries);
      return balances.buckets.vault;
    });

    const beforeWgbCount: number = await page.evaluate(async () => {
      const modPath = "/src/lib/worker-gold-book-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useWorkerGoldBook.getState().refresh();
      return mod.useWorkerGoldBook.getState().entries.length;
    });

    // Issue #1: Gold
    await page.getByTestId("order-issue-gold-material").click();
    await page.getByTestId("issue-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("issue-weight-input").fill("2");
    await page.getByTestId("issue-submit").click();
    await expect(page.getByText(/issuing…/i)).toBeHidden({ timeout: 10_000 });

    await expect(page.locator("text=Issue History").first()).toBeVisible();
    await expect(page.getByText(/Gold · 2\.000 g/)).toBeVisible({ timeout: 10_000 });
    // Let the first dialog's close animation fully finish before reopening —
    // otherwise the lingering overlay can intercept the next click.
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Issue #2: KDM material, different worker/weight — confirms multiple issues supported
    await page.getByTestId("order-issue-gold-material").click();
    await expect(page.getByTestId("issue-worker-select")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("issue-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("issue-material-select").click();
    await page.getByRole("option", { name: "KDM" }).click();
    await page.getByTestId("issue-weight-input").fill("1.5");
    await page.getByTestId("issue-submit").click();
    await expect(page.getByText(/issuing…/i)).toBeHidden({ timeout: 10_000 });

    await expect(page.getByText(/KDM · 1\.500 g/)).toBeVisible({ timeout: 10_000 });

    const historyRows = page.getByTestId("order-issue-history-list").locator("li");
    await expect(historyRows).toHaveCount(2, { timeout: 10_000 });

    // Verify Gold Ledger actually moved (vault decreased by the two gold-purity issues)
    const afterVault: number = await page.evaluate(async () => {
      const modPath = "/src/lib/ledger-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useLedger.getState().refresh();
      const balances = mod.computeBalances(mod.useLedger.getState().entries);
      return balances.buckets.vault;
    });
    expect(afterVault).toBeLessThan(beforeVault);

    // Verify Worker Gold Book got 2 new entries
    const afterWgbCount: number = await page.evaluate(async () => {
      const modPath = "/src/lib/worker-gold-book-store.ts";
      const mod = await import(/* @vite-ignore */ modPath);
      await mod.useWorkerGoldBook.getState().refresh();
      return mod.useWorkerGoldBook.getState().entries.length;
    });
    expect(afterWgbCount).toBe(beforeWgbCount + 2);
  });
});
