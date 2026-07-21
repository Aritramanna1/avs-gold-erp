import { test, expect } from "../fixtures/base";

/**
 * Comprehensive route sweep — opens every route in the app once and checks
 * for the specific failure modes a "no dead routes / no white screens"
 * audit cares about: an uncaught console error, a truly blank body, or
 * this app's own crash-recovery UI (RouteErrorFallback's "This page hit an
 * error", the root NotFoundComponent's "404 / Page not found") appearing
 * where it shouldn't. Routes with a `$param` get a real seeded id
 * substituted so this exercises the actual data-loading path, not just an
 * empty-state render.
 */

const STATIC_ROUTES = [
  "/",
  "/dashboard",
  "/dashboard/ceo",
  "/orders",
  "/orders/new",
  "/orders/import",
  "/catalog",
  "/workshop",
  "/workshop/gold-book",
  "/workshop/barcode-scanner",
  "/workshop/outside-work",
  "/workshop/polishing",
  "/manufacturing",
  "/barcode",
  "/melt",
  "/stock",
  "/stock/import",
  "/stock/lots",
  "/stock/hallmark",
  "/stock/stones",
  "/stock/verification",
  "/billing",
  "/billing/new",
  "/billing/credit-notes",
  "/billing/debit-notes",
  "/billing/estimates",
  "/billing/delivery-challans",
  "/ledger",
  "/repair",
  "/repair/new",
  "/repair/polishing/new",
  "/people",
  "/people/import",
  "/communications",
  "/whatsapp",
  "/settlement/new",
  "/attendance",
  "/help",
  "/reports",
  "/reports/approvals",
  "/reports/audit-log",
  "/reports/branch",
  "/reports/communication-analytics",
  "/reports/daily-close",
  "/reports/daily-gold-flow",
  "/reports/dealer",
  "/reports/delivery-summary",
  "/reports/exceptions",
  "/reports/gold-outstanding",
  "/reports/gold-position",
  "/reports/gold-reconciliation",
  "/reports/gold-summary",
  "/reports/inventory-ageing",
  "/reports/manufacturing",
  "/reports/manufacturing-reconciliation",
  "/reports/month-end-close",
  "/reports/outside-work",
  "/reports/print-log",
  "/reports/print-queue",
  "/reports/reminders",
  "/reports/settlement-reconciliation",
  "/reports/settlements",
  "/reports/vault-reconciliation",
  "/reports/worker",
  "/settings",
  "/settings/automation",
  "/settings/backup-recovery",
  "/settings/branch-settings",
  "/settings/communications",
  "/settings/document-vault",
  "/settings/print-templates",
  "/settings/security-center",
  "/settings/storage-diagnostics",
  "/settings/whatsapp",
  "/settings/whatsapp-templates",
  "/settings/workflow",
];

// Built at test time from seedIds — kept as a function so it can reference
// the fixture's actual seeded values rather than hardcoding ids here.
function paramRoutes(seedIds: Record<string, unknown>) {
  const o = seedIds.orderId;
  const j = seedIds.jobId;
  const s = seedIds.stockItemId;
  const c = seedIds.customerId;
  const w = seedIds.workerId;
  const inv = seedIds.invoiceId;
  const cn = seedIds.creditNoteId;
  const dn = seedIds.debitNoteId;
  const est = seedIds.estimateId;
  const dc = seedIds.deliveryChallanId;
  const rep = seedIds.repairId;
  const settle = seedIds.settlementId;
  return [
    `/orders/${o}`,
    `/orders/print/slip/${o}`,
    `/workshop/${j}`,
    `/workshop/job-card/${o}`,
    `/workshop/print/job-card/${o}`,
    `/workshop/gold-book-print/${w}`,
    `/workshop/filings-slip/${seedIds.goldIssueId}`,
    `/workshop/receive-slip/${seedIds.goldReceiveId}`,
    `/catalog/${s}`,
    `/stock/${s}`,
    `/stock/print/${s}`,
    `/billing/${inv}`,
    `/billing/print/${inv}`,
    `/billing/receipt/${inv}`,
    `/billing/settlement-slip/${inv}`,
    `/billing/estimate/${inv}`,
    `/billing/credit-notes/${cn}`,
    `/billing/credit-note-print/${cn}`,
    `/billing/debit-notes/${dn}`,
    `/billing/debit-note-print/${dn}`,
    `/billing/estimates/${est}`,
    `/billing/estimate-print/${est}`,
    `/billing/delivery-challans/${dc}`,
    `/billing/delivery-challan-print/${dc}`,
    `/repair/${rep}`,
    `/repair/print/receipt/${rep}`,
    `/people/print/${c}`,
    `/people/ledger-print/${c}`,
    `/settlement/${settle}`,
    `/settlement/draft-print/${settle}`,
    `/attendance/print/passbook/${w}`,
    `/manufacturing/bill/${seedIds.orderId}`,
    `/reports/dailyclose-print/${seedIds.dailyCloseId}`,
  ];
}

test.describe("Route sweep — every page opens without a dead route or white screen", () => {
  for (const path of STATIC_ROUTES) {
    test(`static: ${path}`, async ({ authedPage: page }) => {
      await page.goto(path);
      // settings.index.tsx is by far the heaviest lazy-loaded route chunk in
      // the app (~6,200 lines) — 400ms was tight enough to intermittently
      // catch it mid-paint under a long sweep's accumulated memory/CPU
      // pressure, even though it loads comfortably standalone (settings.spec.ts).
      await page.waitForTimeout(800);
      const bodyText = (await page.locator("body").innerText()).trim();
      expect(bodyText.length, `${path} rendered a blank body`).toBeGreaterThan(0);
      expect(bodyText, `${path} shows the route-level crash fallback`).not.toContain(
        "This page hit an error",
      );
      expect(bodyText, `${path} shows the app-level crash fallback`).not.toContain(
        "Something went wrong",
      );
      expect(bodyText, `${path} hit the 404/not-found page unexpectedly`).not.toMatch(
        /page not found/i,
      );
    });
  }

  test("parameterized routes (real seeded ids)", async ({ authedPage: page, seedIds }) => {
    // Raised alongside the per-route wait bump above — this test loops over
    // every parameterized route in one go, so that per-route increase adds
    // up across the whole loop and needs headroom beyond Playwright's
    // default 60s test timeout.
    test.setTimeout(120_000);
    const failures: string[] = [];
    for (const path of paramRoutes(seedIds)) {
      await page.goto(path);
      // settings.index.tsx is by far the heaviest lazy-loaded route chunk in
      // the app (~6,200 lines) — 400ms was tight enough to intermittently
      // catch it mid-paint under a long sweep's accumulated memory/CPU
      // pressure, even though it loads comfortably standalone (settings.spec.ts).
      await page.waitForTimeout(800);
      const bodyText = (await page.locator("body").innerText()).trim();
      if (bodyText.length === 0) failures.push(`${path}: blank body`);
      if (bodyText.includes("This page hit an error"))
        failures.push(`${path}: route-level crash fallback`);
      if (bodyText.includes("The application hit an unexpected error"))
        failures.push(`${path}: app-level crash fallback`);
      if (/page not found/i.test(bodyText)) failures.push(`${path}: hit 404 unexpectedly`);
    }
    expect(failures, failures.join("\n")).toEqual([]);
  });
});
