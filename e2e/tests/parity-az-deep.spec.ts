import { test, expect } from "../fixtures/base";
import {
  CRASH_MARKERS,
  discoverInvoiceIdFromBilling,
  downloadFromPrintPreview,
} from "../helpers/parity-live";

/** Reports with universal Print button (triggerPrint) — sample for print/PDF chain smoke. */
const REPORTS_WITH_PRINT = [
  "/reports/gold-ledger",
  "/reports/gold-stock",
  "/reports/sales-register",
  "/reports/purchase-register",
  "/reports/stock-valuation",
  "/reports/barcode-stock",
  "/reports/hsn-summary",
  "/reports/metal-position",
];

/** Sidebar group labels from 5190 / navigation i18n (uppercase in DOM). */
const EXPECTED_SIDEBAR_GROUPS = [
  "HOME",
  "MASTER",
  "TRANSACTION",
  "PAYROLL",
  "BARCODE",
  "UTILITY",
  "REPORTS",
  "PRODUCTION",
  "GST / ESTIMATE",
  "SCHEME",
  "BULLION",
  "AVS PLATFORM",
];

/** Every authenticated report index route (no print/$param variants). */
const REPORT_INDEX_ROUTES = [
  "/reports",
  "/reports/account-balance",
  "/reports/approvals",
  "/reports/audit-log",
  "/reports/auditor",
  "/reports/bank-transactions",
  "/reports/barcode-stock",
  "/reports/branch",
  "/reports/bullion-ledger",
  "/reports/cash-flow",
  "/reports/city-wise",
  "/reports/communication-analytics",
  "/reports/daily-close",
  "/reports/daily-gold-flow",
  "/reports/daily-summary",
  "/reports/dar-rojmel",
  "/reports/dealer",
  "/reports/deleted-bills",
  "/reports/delivery-summary",
  "/reports/dhadi-book",
  "/reports/erp-audit",
  "/reports/exceptions",
  "/reports/fine-margin",
  "/reports/fine-rojmel",
  "/reports/financial-statements",
  "/reports/gold-ledger",
  "/reports/gold-loss",
  "/reports/gold-outstanding",
  "/reports/gold-position",
  "/reports/gold-reconciliation",
  "/reports/gold-stock",
  "/reports/gold-summary",
  "/reports/gst-returns",
  "/reports/hsn-summary",
  "/reports/inventory-ageing",
  "/reports/item-jama-nave",
  "/reports/item-transaction",
  "/reports/itc04",
  "/reports/ledgers",
  "/reports/manufacturing",
  "/reports/manufacturing-reconciliation",
  "/reports/metal-position",
  "/reports/month-end-close",
  "/reports/outside-work",
  "/reports/purchase-register",
  "/reports/reconciliation-center",
  "/reports/reminders",
  "/reports/sales-register",
  "/reports/scheme",
  "/reports/settlement-reconciliation",
  "/reports/settlements",
  "/reports/stock-valuation",
  "/reports/tally-export",
  "/reports/tanch-hishob",
  "/reports/vault-reconciliation",
  "/reports/worker",
  "/reports/day-wise",
];

test.describe("A–Z parity deep audit (5190 reference)", () => {
  test.setTimeout(180_000);

  test("document title and favicon use AVS ERP branding", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/AVS ERP/i);
    const iconHref = await page.locator('link[rel="icon"]').first().getAttribute("href");
    expect(iconHref).toMatch(/ornexa-mark\.png/i);
  });

  test("sidebar groups match 5190 hierarchy labels", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 1400, height: 900 });
    await authedPage.goto("/app", { waitUntil: "domcontentloaded" });
    await authedPage.waitForTimeout(3_000);
    await expect(
      authedPage.getByRole("menubar", { name: /Offline ERP main menu/i }),
    ).toBeVisible({ timeout: 30_000 });
    const body = await authedPage.locator("body").innerText();
    for (const group of EXPECTED_SIDEBAR_GROUPS) {
      expect(body, `missing sidebar group ${group}`).toMatch(new RegExp(group.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
    expect(body).not.toMatch(/Staging/i);
    expect(body).not.toMatch(/Home Grouped/i);
    expect(body).not.toMatch(/Master Group/i);
  });

  test("people tab counts are numeric (customers, karigars, vendors)", async ({ authedPage }) => {
    await authedPage.goto("/people", { waitUntil: "domcontentloaded" });
    const customerTab = authedPage.getByRole("tab", {
      name: /^(Party \/ Grahak|Customers)\b/i,
    });
    await expect(customerTab).toBeVisible({ timeout: 30_000 });
    for (const name of [
      /^(Party \/ Grahak|Customers)\b/i,
      /^Karigar/i,
      /^(Suppliers & Vendors|Vendors)/i,
    ]) {
      const tab = authedPage.getByRole("tab", { name });
      const text = await tab.innerText();
      expect(text).toMatch(/\d+/);
    }
  });

  test("gold ledger report loads via paginated path (no full-table timeout crash)", async ({
    authedPage,
  }) => {
    const errors: string[] = [];
    authedPage.on("console", (msg) => {
      if (msg.type() === "error" && /57014|statement timeout/i.test(msg.text())) {
        errors.push(msg.text());
      }
    });
    await authedPage.goto("/reports/gold-ledger", { waitUntil: "domcontentloaded" });
    await authedPage.waitForTimeout(5_000);
    const body = await authedPage.locator("body").innerText();
    for (const marker of CRASH_MARKERS) {
      expect(body).not.toContain(marker);
    }
    expect(body.length).toBeGreaterThan(100);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("barcode stock report loads with print action", async ({ authedPage }) => {
    await authedPage.goto("/reports/barcode-stock", { waitUntil: "domcontentloaded" });
    await expect(authedPage.locator("body")).not.toContainText("Something went wrong", {
      timeout: 10_000,
    });
    const printBtn = authedPage.getByRole("button", { name: /print/i }).first();
    await expect(printBtn).toBeVisible({ timeout: 20_000 });
  });

  test("verify (QR) public route loads", async ({ page }) => {
    await page.goto("/verify", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(20);
  });

  test("404 uses sign-in-aware recovery when authenticated", async ({ authedPage }) => {
    await authedPage.goto("/this-route-does-not-exist-parity-az", {
      waitUntil: "domcontentloaded",
    });
    await expect(authedPage.getByText(/page not found/i)).toBeVisible({ timeout: 10_000 });
    const link = authedPage.getByRole("link", { name: /go home|go to sign in/i });
    await expect(link).toBeVisible();
  });
});

test.describe("Reports index routes — no crash / blank body", () => {
  test.setTimeout(300_000);

  for (const route of REPORT_INDEX_ROUTES) {
    test(`report loads: ${route}`, async ({ authedPage }) => {
      const errors: string[] = [];
      authedPage.on("console", (msg) => {
        if (msg.type() === "error" && /pull:|statement timeout|57014/i.test(msg.text())) {
          errors.push(msg.text());
        }
      });
      await authedPage.goto(route, { waitUntil: "domcontentloaded" });
      await authedPage.waitForTimeout(600);
      const body = (await authedPage.locator("body").innerText()).trim();
      expect(body.length, `${route} blank body`).toBeGreaterThan(0);
      for (const marker of CRASH_MARKERS) {
        expect(body, `${route} crash: ${marker}`).not.toContain(marker);
      }
      expect(body, `${route} unexpected 404`).not.toMatch(/^404\s*$/m);
      if (/page not found/i.test(body) && !body.includes("Reports")) {
        throw new Error(`${route} hit 404 unexpectedly`);
      }
    });
  }
});

test.describe("Deep workflow shells (real data paths)", () => {
  test.setTimeout(120_000);

  test("ledger material vault tab loads", async ({ authedPage }) => {
    await authedPage.goto("/ledger", { waitUntil: "domcontentloaded" });
    await authedPage.getByTestId("tab-material-vault").click();
    await expect(authedPage.getByTestId("material-adjustment-open")).toBeVisible({
      timeout: 20_000,
    });
  });

  test("billing hub loads with invoice list area", async ({ authedPage }) => {
    await authedPage.goto("/billing", { waitUntil: "domcontentloaded" });
    await expect(authedPage.getByText(/billing/i).first()).toBeVisible({ timeout: 20_000 });
    const body = await authedPage.locator("body").innerText();
    expect(body).not.toContain("Something went wrong");
  });

  test("customer portal login shell loads", async ({ page }) => {
    await page.goto("/customer-portal", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const body = await page.locator("body").innerText();
    expect(body.length).toBeGreaterThan(30);
  });

  test("mobile work surface loads", async ({ authedPage }) => {
    await authedPage.setViewportSize({ width: 390, height: 844 });
    await authedPage.goto("/mobile/work", { waitUntil: "domcontentloaded" });
    await expect(authedPage.locator("body")).toBeVisible();
  });
});

test.describe("Live Supabase workflows (5190 parity — real data)", () => {
  test.setTimeout(180_000);
  test.skip(() => process.env.E2E_LIVE_DATA !== "true", "Requires E2E_LIVE_DATA=true");

  test("barcode workspace shows real stock/tag records", async ({ authedPage }) => {
    await authedPage.goto("/barcode", { waitUntil: "domcontentloaded" });
    await authedPage.waitForTimeout(4_000);
    const body = await authedPage.locator("body").innerText();
    expect(body).not.toContain("Something went wrong");
    expect(body).toMatch(/Total barcodes/i);
    expect(body).toMatch(/\d+/);
  });

  test("billing → print → verification QR (live invoice)", async ({ authedPage }) => {
    const invoiceId = await discoverInvoiceIdFromBilling(authedPage);
    test.skip(!invoiceId, "No invoice on billing list — cannot exercise live print chain");

    await authedPage.goto(`/billing/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(authedPage.getByText(/invoice loading failure|couldn't load this section/i)).toHaveCount(
      0,
    );

    await authedPage.goto(`/billing/print/${invoiceId}`, { waitUntil: "domcontentloaded" });
    await expect(authedPage.getByText(/invoice loading failure|couldn't load this section/i)).toHaveCount(
      0,
      { timeout: 20_000 },
    );

    const root = authedPage.getByTestId("print-layout-root");
    await expect(root).toBeVisible({ timeout: 30_000 });
    await expect(authedPage.getByRole("button", { name: /download pdf/i })).toBeVisible();

    const qr = root.getByAltText("Verification QR");
    if ((await qr.count()) > 0) {
      await expect(qr.first()).toBeVisible({ timeout: 15_000 });
    }

    const [download] = await Promise.all([
      authedPage.waitForEvent("download", { timeout: 45_000 }),
      authedPage.getByRole("button", { name: /download pdf/i }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  });

  test("vault material issue surface loads on ledger", async ({ authedPage }) => {
    await authedPage.goto("/ledger", { waitUntil: "domcontentloaded" });
    await authedPage.getByTestId("tab-material-vault").click();
    await expect(authedPage.getByTestId("material-adjustment-open")).toBeVisible({
      timeout: 20_000,
    });
    const body = await authedPage.locator("body").innerText();
    expect(body).toMatch(/Raw Gold|Material Vault/i);
  });

  test("customer portal login shell + Google OAuth button on ERP login", async ({ page }) => {
    await page.goto("/customer-portal", { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    const portalBody = await page.locator("body").innerText();
    expect(portalBody.length).toBeGreaterThan(30);

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const googleBtn = page.getByRole("button", { name: /google|continue with google/i });
    await expect(googleBtn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("login page footer matches shop trial/invite hint", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const accept = page.getByRole("button", { name: /accept all|essential only/i });
    if (await accept.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
      await accept.first().click();
    }
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/invite|trial|sign in|corporation email/i);
  });
});

test.describe("Reports print/PDF smoke (live data sample)", () => {
  test.setTimeout(120_000);
  test.skip(() => process.env.E2E_LIVE_DATA !== "true", "Requires E2E_LIVE_DATA=true");

  for (const route of REPORTS_WITH_PRINT) {
    test(`print action: ${route}`, async ({ authedPage }) => {
      await authedPage.goto(route, { waitUntil: "domcontentloaded" });
      await authedPage.waitForTimeout(3_000);
      const body = await authedPage.locator("body").innerText();
      for (const marker of CRASH_MARKERS) {
        expect(body, `${route} crash`).not.toContain(marker);
      }
      const printBtn = authedPage.getByRole("button", { name: /^print$/i }).first();
      await expect(printBtn).toBeVisible({ timeout: 20_000 });
      await printBtn.click();
      await downloadFromPrintPreview(authedPage);
    });
  }
});
