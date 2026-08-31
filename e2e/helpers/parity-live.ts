import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const CRASH_MARKERS = [
  "This page hit an error",
  "Something went wrong",
  "Application error",
  "We couldn't load this section",
];

export async function dismissCookies(page: Page) {
  const accept = page.getByRole("button", { name: /accept all|essential only/i });
  if (await accept.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await accept.first().click();
  }
}

/** Navigate to a report route and wait until the shell has rendered real content. */
export async function gotoReportReady(page: Page, route: string): Promise<string> {
  await dismissCookies(page);
  await page.goto(route, { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () => {
        const text = document.body?.innerText?.replace(/\s+/g, " ").trim() ?? "";
        return text.length > 50 && !/secure sign in|corporation email/i.test(text);
      },
      null,
      { timeout: 60_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(1_500);
  return (await page.locator("body").innerText()).trim();
}

/** Discover invoice id from the authenticated firm's /billing list only. */
export async function discoverInvoiceIdFromBilling(page: Page): Promise<string | null> {
  await page.goto("/billing", { waitUntil: "domcontentloaded" });
  await page
    .waitForFunction(
      () => document.querySelectorAll('a[href^="/billing/"]').length > 0,
      null,
      { timeout: 90_000 },
    )
    .catch(() => {});

  const pickFromRow = async (rowLocator: ReturnType<Page["locator"]>) => {
    const link = rowLocator.locator('a[href^="/billing/"]').first();
    const href = await link.getAttribute("href").catch(() => null);
    const m = href?.match(/^\/billing\/(inv_[a-z0-9_]+)$/i);
    return m?.[1] ?? null;
  };

  const gstRow = page.locator("tr").filter({ hasText: /tax invoice|gst|3%/i }).first();
  if (await gstRow.count()) {
    const id = await pickFromRow(gstRow);
    if (id) return id;
  }

  const links = page.locator('a[href^="/billing/"]');
  for (let i = 0; i < (await links.count()); i++) {
    const href = await links.nth(i).getAttribute("href");
    const m = href?.match(/^\/billing\/(inv_[a-z0-9_]+)$/i);
    if (m) return m[1];
  }
  return null;
}

export async function assertNoCrashBody(body: string, route: string) {
  for (const marker of CRASH_MARKERS) {
    expect(body, `${route} crash: ${marker}`).not.toContain(marker);
  }
}

/** After clicking Print on a report page, wait for preview modal and download PDF. */
export async function downloadFromPrintPreview(page: Page): Promise<void> {
  const downloadBtn = page
    .getByRole("button", { name: /^download pdf$|^download$/i })
    .first();
  await expect(downloadBtn).toBeVisible({ timeout: 90_000 });
  const [download] = await Promise.all([
    page.waitForEvent("download", { timeout: 90_000 }),
    downloadBtn.click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
}

/** Print → preview → PDF, or export download, or book-print layout on report index routes. */
export async function exerciseReportPrintExportOrPreview(page: Page, route: string): Promise<void> {
  const body = await gotoReportReady(page, route);
  await assertNoCrashBody(body, route);
  expect(body.length, `${route} blank`).toBeGreaterThan(50);

  const printBtn = page.getByRole("button", { name: /^print$/i }).first();
  let exportBtn = page.getByRole("button", { name: /export csv|export xlsx|export|csv|xlsx|xml/i }).first();
  if (route.includes("/reports/gst-returns")) {
    exportBtn = page.getByTestId("report-export-gstr3b");
  } else if (route.includes("/reports/tally-export")) {
    exportBtn = page.getByTestId("report-export-tally-xml");
  }
  const openPrintLink = page.getByRole("link", { name: /print|open print|view print/i }).first();

  if (await printBtn.isVisible().catch(() => false)) {
    await expect(printBtn).toBeEnabled({ timeout: 60_000 });
    await printBtn.click();
    await downloadFromPrintPreview(page);
    await page.keyboard.press("Escape").catch(() => {});
    return;
  }

  if (await openPrintLink.isVisible().catch(() => false)) {
    const href = await openPrintLink.getAttribute("href");
    if (href && (href.includes("/reports/book-print") || href.includes("-print"))) {
      await page.goto(href, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(2_500);
      const printBody = await page.locator("body").innerText();
      await assertNoCrashBody(printBody, href);
      const root = page.getByTestId("print-layout-root");
      if (await root.count()) {
        await expect(root).toBeVisible({ timeout: 30_000 });
        const pdfBtn = page.getByRole("button", { name: /download pdf/i });
        if (await pdfBtn.isVisible().catch(() => false)) {
          const [download] = await Promise.all([
            page.waitForEvent("download", { timeout: 90_000 }),
            pdfBtn.click(),
          ]);
          expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
        }
      }
      return;
    }
  }

  if (await exportBtn.isVisible().catch(() => false)) {
    if (route.includes("/reports/gst-returns")) {
      await expect(exportBtn).toBeEnabled({ timeout: 90_000 });
    }
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      exportBtn.click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.(csv|xlsx|pdf|xml)$/i);
    return;
  }

  expect(body.length, `${route} has no print/export`).toBeGreaterThan(100);
}
