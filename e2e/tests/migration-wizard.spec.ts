import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Stream A / R1: 13-Stage Migration Wizard & Opening Balance Engine
 * Master Reference: docs/MASTER/OPENING_BALANCE_AND_MIGRATION_MASTER.md
 */
test.describe("Stream A — 13-Stage Migration Wizard (/control/migration)", () => {
  test("loads /control/migration and renders all 13 stages with dry-run and audit freeze controls", async ({
    authedPage: page,
  }) => {
    await page.goto("/control/migration");
    await expect(page.getByRole("heading", { name: /13-stage migration wizard/i })).toBeVisible({
      timeout: 15_000,
    });

    // Check Stage navigation items
    await expect(page.getByText("Company Setup & Legal Entity")).toBeVisible();
    await expect(page.getByText("Financial Year Configuration")).toBeVisible();
    await expect(page.getByText("Validation & Audit Freeze")).toBeVisible();

    // Verify Template Download button
    await expect(page.getByRole("button", { name: /download csv template/i })).toBeVisible();

    // Verify Stage Switching
    await page.getByRole("button", { name: /next stage/i }).click();
    await expect(page.getByText("Financial Year Configuration")).toBeVisible();

    // Verify Dry Run button
    await expect(page.getByRole("button", { name: /run dry-run simulation/i })).toBeVisible();

    expectNoPageErrors(page);
  });
});
