import { test, expect, expectNoPageErrors } from "../fixtures/base";

/**
 * Stream B / R2: Daily Bhav Rate Book & Purity Propagation
 * Master Reference: docs/MASTER/RATE_BOOK_MASTER.md & ITEM_AND_MATERIAL_MASTER.md
 */
test.describe("Stream B — Daily Bhav Rate Book (/control/rates)", () => {
  test("loads /control/rates and correctly displays multi-karat purities and derived calculations", async ({
    authedPage: page,
  }) => {
    await page.goto("/control/rates");
    await expect(page.getByRole("heading", { name: /daily bhav rate book/i })).toBeVisible({
      timeout: 15_000,
    });

    // Check Purity inputs
    await expect(page.getByText("24K Pure Gold (999/1000)")).toBeVisible();
    await expect(page.getByText("22K Standard Gold (916/1000)")).toBeVisible();
    await expect(page.getByText("18K Hallmark Gold (750/1000)")).toBeVisible();
    await expect(page.getByText("925 Fine Silver")).toBeVisible();

    // Check Purity Fineness Matrix
    await expect(page.getByText("Purity Fineness Matrix")).toBeVisible();
    await expect(page.getByText("14K 585 (Derived)")).toBeVisible();

    expectNoPageErrors(page);
  });
});
