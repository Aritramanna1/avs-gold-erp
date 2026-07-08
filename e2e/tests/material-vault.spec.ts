import { test, expect } from "../fixtures/base";

// Material Conversion was removed as an obsolete manual step — every real
// material movement now flows through Worker Issue, Worker Return, and
// Outside Work; the Authorized Adjustment dialog remains as the ONLY
// manual-edit path (for physical stock count corrections), fully audited
// and confirmation-gated.
test.describe("Gold & Material Vault — Authorized Adjustment", () => {
  test("recording an authorized adjustment updates the balance, requires confirmation, and appears in transaction history", async ({
    authedPage: page,
  }) => {
    await page.goto("/ledger");
    await page.getByTestId("tab-material-vault").click();
    await expect(page.getByTestId("material-adjustment-open")).toBeVisible({ timeout: 15_000 });

    // Read the currently-displayed Raw Gold balance from the DOM (the real
    // rendered app state) rather than a separately dynamically-imported
    // module instance — a second import of a store module from a raw
    // absolute path can resolve to a distinct instance from the one the
    // already-mounted page is using, which would silently observe none of
    // this test's own writes despite them landing correctly in the database.
    async function rawGoldBalanceG(): Promise<number> {
      const row = page.getByText("Raw Gold").locator("..");
      const text = await row.locator("span.font-mono").last().textContent();
      return parseFloat((text ?? "0").replace(/[^0-9.]/g, "")) || 0;
    }

    const before = await rawGoldBalanceG();

    await page.getByTestId("material-adjustment-open").click();
    await page.getByText("Category *").locator("..").locator("button").click();
    await page.getByRole("option", { name: "Raw Gold" }).click();
    await page.getByPlaceholder(/e.g. -0.500/).fill("100");
    await page.getByPlaceholder(/Required — physical stock/).fill("E2E: opening raw gold stock");

    // Confirmation is required — the dialog must not commit on the first click.
    await page.getByTestId("adjustment-submit").click();
    await expect(page.getByTestId("adjustment-confirm")).toBeVisible({ timeout: 5_000 });
    await page.getByTestId("adjustment-confirm").click();
    await expect(page.getByRole("dialog")).toBeHidden({ timeout: 10_000 });

    await expect
      .poll(async () => rawGoldBalanceG(), { timeout: 10_000 })
      .toBeGreaterThanOrEqual(before + 100);

    const historyTable = page.getByTestId("material-vault-history");
    await expect(historyTable.getByText("Adjustment").first()).toBeVisible();
    await expect(historyTable.getByText(/E2E: opening raw gold stock/).first()).toBeVisible();
  });
});
