import { test, expect } from "../fixtures/base";

/**
 * Functional parity golden path — run 2–3× via `npm run test:e2e:parity`.
 * Uses authenticated session from global-setup (.env.e2e → CURRENT Supabase).
 */
const GOLDEN_ROUTES = [
  { path: "/app", label: "Home" },
  { path: "/people", label: "People" },
  { path: "/stock", label: "Stock" },
  { path: "/orders", label: "Orders" },
  { path: "/ledger", label: "Gold / Ledger" },
  { path: "/billing", label: "Billing" },
  { path: "/workshop", label: "Workshop" },
  { path: "/reports", label: "Reports" },
  { path: "/verify", label: "Verify" },
  { path: "/customer-portal", label: "Customer portal" },
  { path: "/settings", label: "Settings" },
];

test.describe("Parity golden path (authenticated)", () => {
  test.setTimeout(120_000);

  test("data load completes without fatal error toast", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && /statement timeout|pull:/i.test(msg.text())) {
        errors.push(msg.text());
      }
    });
    await page.goto("/app", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(8_000);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("people tab shows numeric karigar/customer counts", async ({ page }) => {
    await page.goto("/people", { waitUntil: "domcontentloaded" });
    const customerTab = page.getByRole("tab", { name: /^(Party \/ Grahak|Customers)\b/i });
    await expect(customerTab).toBeVisible({ timeout: 30_000 });
    const karigarTab = page.getByRole("tab", { name: /^Karigar/i });
    await expect(karigarTab).toBeVisible();
    const customerText = await customerTab.innerText();
    const karigarText = await karigarTab.innerText();
    expect(customerText).toMatch(/\d+/);
    expect(karigarText).toMatch(/\d+/);
  });

  for (const route of GOLDEN_ROUTES) {
    test(`route loads: ${route.label} (${route.path})`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toContainText("Application error", { timeout: 5_000 });
      await expect(page.locator("body")).not.toContainText("Something went wrong", {
        timeout: 5_000,
      });
    });
  }

  test("mobile work surface loads", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/mobile/work", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});
