import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Stream I / R9 — Encrypted Tenant Backup & Disaster Recovery.
 * Verifies that the page correctly provides multi-layer resilience status,
 * self-service encrypted .ornexa.enc export, and 7-phase controlled restore controls.
 */
test.describe("Backup & Disaster Recovery", () => {
  test("backup-recovery page renders layered resilience status and encrypted export options", async ({
    authedPage: page,
  }) => {
    await page.goto("/settings/backup-recovery");
    await expect(page.getByRole("heading", { name: /backup & disaster recovery/i })).toBeVisible({
      timeout: 15_000,
    });
    // Layered Resilience Cards
    await expect(page.getByText(/Layer 1: PostgreSQL WAL/i)).toBeVisible();
    await expect(page.getByText(/Layer 3: R2 Document Store/i)).toBeVisible();
    await expect(page.getByText(/Layer 4: Encrypted Exports/i)).toBeVisible();

    // Export Tab
    await expect(page.getByRole("button", { name: /generate.*(backup|archive)/i })).toBeVisible();

    // Switch to Restore Tab
    await page.getByRole("tab", { name: /restore/i }).click();
    await expect(page.getByText(/upload \.ornexa\.enc|select.*backup/i)).toBeVisible();

    expectNoPageErrors(page);
  });
});
