/**
 * Mobile ERP 5-tab bottom navigation parity (5190 offline phone chrome).
 */
import { test, expect } from "../fixtures/base";

const MOBILE_VIEW = { width: 390, height: 844 };

const TABS = [
  { href: "/app", label: /home/i },
  { href: "/mobile/work", label: /production|work/i },
  { href: "/mobile/business", label: /transaction|business/i },
  { href: "/mobile/reports", label: /reports/i },
  { href: "/mobile/more", label: /more/i },
] as const;

test.describe("Mobile 5-tab ERP parity", () => {
  test.use({ viewport: MOBILE_VIEW });
  test.setTimeout(120_000);

  test.beforeEach(async ({ authedPage }) => {
    const accept = authedPage.getByRole("button", { name: /accept all|essential only/i });
    if (await accept.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
      await accept.first().click();
    }
  });

  test("bottom nav shows all five tabs with AVS labels", async ({ authedPage }) => {
    await authedPage.goto("/app", { waitUntil: "domcontentloaded" });
    await authedPage.waitForTimeout(2_000);
    const nav = authedPage.getByRole("navigation", { name: /primary navigation/i });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    for (const tab of TABS) {
      await expect(nav.getByRole("link", { name: tab.label })).toBeVisible();
    }
  });

  for (const tab of TABS) {
    test(`tab navigates: ${tab.href}`, async ({ authedPage }) => {
      await authedPage.goto("/app", { waitUntil: "domcontentloaded" });
      const nav = authedPage.getByRole("navigation", { name: /primary navigation/i });
      await expect(nav).toBeVisible({ timeout: 20_000 });
      await nav.getByRole("link", { name: tab.label }).click();
      await authedPage.waitForURL(new RegExp(tab.href.replace(/\//g, "\\/")), { timeout: 15_000 });
      const body = await authedPage.locator("body").innerText();
      expect(body).not.toMatch(/something went wrong|couldn't load this section/i);
      expect(body.length).toBeGreaterThan(40);
    });
  }

  test("mobile reports hub lists report categories", async ({ authedPage }) => {
    await authedPage.goto("/app", { waitUntil: "domcontentloaded" });
    const nav = authedPage.getByRole("navigation", { name: /primary navigation/i });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await nav.getByRole("link", { name: /reports/i }).click();
    await authedPage.waitForURL(/\/mobile\/reports/, { timeout: 15_000 });
    await expect(authedPage.getByRole("link", { name: /^Reports$/i }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(authedPage.getByRole("link", { name: /Fine Rojmel|Gold Ledger/i }).first()).toBeVisible();
  });

  test("mobile business hub loads billing/people entry points", async ({ authedPage }) => {
    await authedPage.goto("/app", { waitUntil: "domcontentloaded" });
    const nav = authedPage.getByRole("navigation", { name: /primary navigation/i });
    await expect(nav).toBeVisible({ timeout: 20_000 });
    await nav.getByRole("link", { name: /transaction|business/i }).click();
    await authedPage.waitForURL(/\/mobile\/business/, { timeout: 15_000 });
    await expect(authedPage.getByRole("link", { name: /parties|people|sale|invoice/i }).first()).toBeVisible({
      timeout: 20_000,
    });
  });
});
