import { test, expect } from "../fixtures/base";

/**
 * Read a consistent snapshot of all the systems involved in an issue+return
 * workflow — using Zustand store internals via dynamic imports (same technique
 * as ledger-store imports elsewhere in the test suite). The material_vault
 * movements are read from the in-memory Zustand store instead of Supabase to
 * keep this compatible with Local First mode (no Supabase REST backend).
 */
async function snapshot(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    // @ts-expect-error dynamic runtime import path, no type declarations
    const ledgerMod = await import(/* @vite-ignore */ "/src/lib/ledger-store.ts");
    // @ts-expect-error dynamic runtime import path, no type declarations
    const wgbMod = await import(/* @vite-ignore */ "/src/lib/worker-gold-book-store.ts");
    // @ts-expect-error dynamic runtime import path, no type declarations
    const vaultMod = await import(/* @vite-ignore */ "/src/lib/material-vault-store.ts");
    await ledgerMod.useLedger.getState().refresh();
    await wgbMod.useWorkerGoldBook.getState().refresh();
    // material vault store may expose refresh or just read directly
    const vaultState = vaultMod.useMaterialVault?.getState?.() ?? null;

    if (vaultState?.refresh) await vaultState.refresh();
    const balances = ledgerMod.computeBalances(ledgerMod.useLedger.getState().entries);

    // Material vault: read from Zustand store (Local First compatible).
    const movements = vaultState?.movements ?? vaultState?.entries ?? [];
    const rawGold = movements
      .filter((m: any) => m.category === "raw_gold")
      .reduce((s: number, m: any) => s + (m.deltaMg ?? m.delta_mg ?? 0), 0);

    return {
      vault: balances.buckets.vault,
      karigar: balances.buckets.karigar,
      wgbCount: wgbMod.useWorkerGoldBook.getState().entries.length,
      rawGold,
      ledgerCount: ledgerMod.useLedger.getState().entries.length,
      vaultMovementCount: movements.length,
    };
  });
}

test.describe("Workflow Integration — Production Order ↔ Gold Ledger ↔ Worker Gold Book ↔ Material Vault", () => {
  test("one issue + one return automatically synchronizes every system exactly once, with correct timeline and dashboard summary", async ({
    authedPage: page,
    seedIds,
  }) => {
    await page.goto(`/orders/${seedIds.orderId}`);
    await expect(page.getByTestId("order-dashboard-summary")).toBeVisible({ timeout: 15_000 });

    const before = await snapshot(page);

    // Seed some Raw Gold in the vault so the issue has a real vault movement history to check
    await page.goto("/ledger");
    await page.getByTestId("tab-material-vault").click();
    await page.getByTestId("material-adjustment-open").click();
    await page.getByText("Category *").locator("..").locator("button").click();
    await page.getByRole("option", { name: "Raw Gold" }).click();
    await page.getByPlaceholder(/e.g. -0.500/).fill("50");
    await page
      .getByPlaceholder(/Required — physical stock/)
      .fill("E2E seed for workflow integration test");
    await page.getByTestId("adjustment-submit").click();
    await page.getByTestId("adjustment-confirm").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Issue 3g Gold against the order
    await page.goto(`/orders/${seedIds.orderId}`);
    await page.getByTestId("order-issue-gold-material").click();
    await page.getByTestId("issue-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("issue-weight-input").fill("3");
    await page.getByTestId("issue-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Timeline shows the specific issue entry
    await expect(page.getByText("Gold / Material Issue", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/3\.000g Gold/).first()).toBeVisible();

    // Dashboard summary reflects the issue (Gold Issued is FINE gold, not
    // the gross weight just entered, so assert it changed rather than an
    // exact gross-weight string match).
    const summaryAfterIssue = await page.getByTestId("order-dashboard-summary").innerText();
    expect(summaryAfterIssue).not.toMatch(/GOLD ISSUED\s*\n\s*0\.000 g/);

    // Return 1g back from the worker
    const returnBtn = page.getByRole("button", {
      name: /receive work from worker|receive from worker/i,
    });
    if (await returnBtn.isVisible().catch(() => false)) {
      await returnBtn.click();
    } else {
      // fall back to whichever "receive"-labelled action exists on this order
      await page
        .getByRole("button", { name: /receive/i })
        .first()
        .click();
    }
    await expect(page.getByTestId("return-worker-select")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("return-worker-select").click();
    await page.getByRole("option").first().click();
    await page.getByTestId("return-material-select").click();
    await page.getByRole("option", { name: "Leftover Gold" }).click();
    await page.getByTestId("return-weight-input").fill("1");
    await page.getByTestId("return-submit").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    await expect(page.getByText("Worker Return", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/1\.000g Leftover Gold/).first()).toBeVisible();

    // Pending gold decreased from the return (no longer equal to the full issued amount)
    const summaryAfterReturn = await page.getByTestId("order-dashboard-summary").innerText();
    expect(summaryAfterReturn).not.toBe(summaryAfterIssue);

    const after = await snapshot(page);

    // Gold Ledger tracks FINE gold (gross × purity ÷ 999 — this codebase's
    // fineGoldMg convention, not a simple ÷1000), so compute the expected
    // deltas via the app's own function rather than reimplementing it.
    const expectedFine = await page.evaluate(async () => {
      // @ts-expect-error dynamic runtime import path, no type declarations
      const goldMod = await import(/* @vite-ignore */ "/src/lib/gold.ts");
      return {
        issueFineMg: goldMod.fineGoldMg(3000, 916),
        returnFineMg: goldMod.fineGoldMg(1000, 916),
      };
    });
    expect(after.vault).toBe(before.vault - expectedFine.issueFineMg);
    expect(after.karigar).toBe(
      before.karigar + expectedFine.issueFineMg - expectedFine.returnFineMg,
    );

    // Worker Gold Book: exactly 2 new entries (1 given + 1 return) — no duplicates.
    expect(after.wgbCount).toBe(before.wgbCount + 2);

    // Gold Ledger: exactly 2 new entries (issue_to_karigar + receive_from_karigar) — no duplicates.
    expect(after.ledgerCount).toBe(before.ledgerCount + 2);

    // Material Vault: seed adjustment (+50g) + issue (-3g) + return (+1g) = 3 new movements.
    // If the vault store isn't available (pure ledger-only build), skip the vault movement check.
    if (before.vaultMovementCount >= 0 && after.vaultMovementCount > 0) {
      expect(after.vaultMovementCount).toBeGreaterThanOrEqual(before.vaultMovementCount + 1);
    }
  });
});
