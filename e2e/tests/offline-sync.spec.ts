import { test, expect } from "../fixtures/base";

/**
 * Priority 4.5 — proves the offline-first pilot (material_vault_movements,
 * the first repository migrated from save() to saveLocal()) actually works
 * end to end: a write made while offline succeeds immediately (local-first),
 * is queued in the outbox, and drains automatically once connectivity
 * returns — without the user ever clicking a "Sync" button.
 */
test.describe("Offline-first sync — material vault (pilot repository)", () => {
  test("an adjustment made offline saves locally, queues in the outbox, and syncs automatically on reconnect", async ({
    authedPage: page,
  }) => {
    await page.goto("/ledger");
    await page.getByTestId("tab-material-vault").click();
    await expect(page.getByTestId("material-adjustment-open")).toBeVisible({ timeout: 15_000 });

    // Go offline — simulates the internet dropping mid-session.
    await page.context().setOffline(true);

    const remarks = `E2E offline write ${Date.now()}`;
    await page.getByTestId("material-adjustment-open").click();
    await page.getByText("Category *").locator("..").locator("button").click();
    await page.getByRole("option", { name: "Raw Gold" }).click();
    await page.getByPlaceholder(/e.g. -0.500/).fill("5");
    await page.getByPlaceholder(/Required — physical stock/).fill(remarks);
    await page.getByTestId("adjustment-submit").click();
    await expect(page.getByTestId("adjustment-confirm")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("adjustment-confirm").click();

    // The write must succeed and appear in the UI immediately — no network
    // round trip is on the critical path for a local-first save().
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });
    const historyTable = page.getByTestId("material-vault-history");
    await expect(historyTable.getByText(remarks).first()).toBeVisible({ timeout: 10_000 });

    // The write must be queued (pending), not silently dropped, while offline.
    await page.waitForFunction(() => !!(window as any).__syncEngine, { timeout: 15_000 });
    const pendingWhileOffline = await page.evaluate(
      () => (window as any).__syncEngine.getSyncStatus().pending,
    );
    expect(pendingWhileOffline).toBeGreaterThan(0);

    // Reconnect — the "online" event listener should trigger an immediate
    // drain without waiting out the rest of the interval.
    await page.context().setOffline(false);

    await expect
      .poll(() => page.evaluate(() => (window as any).__syncEngine.getSyncStatus().pending), {
        timeout: 30_000,
        message: "outbox should drain to zero pending after reconnect",
      })
      .toBe(0);
  });

  test("an outbox entry queued offline survives an app restart and drains on the next boot", async ({
    authedPage: page,
  }) => {
    await page.goto("/ledger");
    await page.getByTestId("tab-material-vault").click();
    await expect(page.getByTestId("material-adjustment-open")).toBeVisible({ timeout: 15_000 });

    await page.context().setOffline(true);

    const remarks = `E2E crash-recovery write ${Date.now()}`;
    await page.getByTestId("material-adjustment-open").click();
    await page.getByText("Category *").locator("..").locator("button").click();
    await page.getByRole("option", { name: "Raw Gold" }).click();
    await page.getByPlaceholder(/e.g. -0.500/).fill("3");
    await page.getByPlaceholder(/Required — physical stock/).fill(remarks);
    await page.getByTestId("adjustment-submit").click();
    await expect(page.getByTestId("adjustment-confirm")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("adjustment-confirm").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    // Reconnect network but reload IMMEDIATELY — before the running
    // scheduler's own "online" listener or interval necessarily gets a
    // chance to drain — so this exercises the outbox row surviving a fresh
    // process boot (crash / power failure / restart), not just the
    // already-running scheduler catching up.
    await page.context().setOffline(false);
    await page.reload();

    await page.getByTestId("tab-material-vault").click();
    await expect(page.getByTestId("material-adjustment-open")).toBeVisible({ timeout: 30_000 });
    await page.waitForFunction(() => !!(window as any).__syncEngine, { timeout: 15_000 });

    // The queued write is still visible (never lost) ...
    const historyTable = page.getByTestId("material-vault-history");
    await expect(historyTable.getByText(remarks).first()).toBeVisible({ timeout: 10_000 });

    // ... and the fresh boot's immediate drain (startSyncOutboxScheduler()
    // runs drainOnce() once right away, not just on the interval) clears it.
    await expect
      .poll(() => page.evaluate(() => (window as any).__syncEngine.getSyncStatus().pending), {
        timeout: 30_000,
        message: "outbox should drain on the next app boot after a restart with a pending queue",
      })
      .toBe(0);
  });
});
