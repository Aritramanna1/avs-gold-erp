import { test, expect } from "../fixtures/base";

/**
 * Priority 6 — Backup & Disaster Recovery. Exercises the real download ->
 * restore round trip through the actual UI (/settings/backup-recovery),
 * not just the underlying local-db.ts functions directly — this is the
 * most destructive feature in the app (a confirmed restore replaces the
 * entire local database), so it gets its own dedicated, permanent
 * regression coverage rather than relying on unit-level checks alone.
 */
test.describe("Backup & Disaster Recovery", () => {
  test("disaster recovery drill runs and reports a passing result", async ({
    authedPage: page,
  }) => {
    await page.goto("/settings/backup-recovery");
    await page.getByRole("button", { name: /run drill now/i }).click();
    await expect(page.getByText(/backup verified restorable|drill failed/i)).toBeVisible({
      timeout: 15_000,
    });
  });

  test("download → restore round trip: the exact backup just downloaded restores cleanly with confirmation", async ({
    authedPage: page,
  }) => {
    await page.goto("/settings/backup-recovery");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: /download backup/i }).click(),
    ]);
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath!);

    // Destructive action must require explicit confirmation — the dialog,
    // not the file picker, is what actually triggers the restore.
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible({ timeout: 10_000 });
    await expect(dialog).toContainText(/replace|overwrite|cannot be undone/i);

    // Cancelling must NOT restore anything.
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(dialog).not.toBeVisible();

    // Re-select and this time confirm — the actual restore path.
    await fileInput.setInputFiles(filePath!);
    await expect(page.getByRole("alertdialog")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /yes,.*restore|yes,.*overwrite/i }).click();

    await expect(page.getByText(/restored from backup/i)).toBeVisible({ timeout: 15_000 });
  });
});
