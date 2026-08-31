/**
 * Side-by-side sidebar + branding capture: localhost vs maatarajewellers.shop.
 * Uses .env.e2e credentials (same Supabase tenant when shop points at CURRENT DB).
 *
 * Output: _reconstruction/parity-sidebar-compare.json
 */
import fs from "fs";
import { chromium } from "playwright";

function loadEnv(p) {
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const email = env.E2E_EMAIL;
const password = env.E2E_PASSWORD;
const license = env.E2E_LICENSE_KEY;

if (!email || !password) {
  console.error("Missing E2E_EMAIL / E2E_PASSWORD in .env.e2e");
  process.exit(1);
}

const TARGETS = [
  { id: "localhost", baseURL: env.E2E_BASE_URL || "http://localhost:3000" },
  { id: "shop5190", baseURL: "https://maatarajewellers.shop" },
];

const EXPECTED_GROUPS = [
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

async function dismissCookieBanner(page) {
  const accept = page.getByRole("button", { name: /accept all|essential only/i });
  if (await accept.first().isVisible({ timeout: 3_000 }).catch(() => false)) {
    await accept.first().click();
    await page.waitForTimeout(500);
  }
}

async function loginAndCapture(baseURL) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ baseURL });
  await page.setViewportSize({ width: 1400, height: 900 });
  const result = { baseURL, ok: false, error: null, title: null, favicon: null, groups: [], bodySample: null };

  try {
    await page.goto("/login", { timeout: 60_000, waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    result.title = await page.title();
    result.favicon = await page.locator('link[rel="icon"]').first().getAttribute("href").catch(() => null);

    const emailEl = page.getByTestId("auth-email");
    if (await emailEl.count()) {
      await emailEl.fill(email, { timeout: 15_000 });
      await page.getByTestId("auth-password").fill(password, { timeout: 15_000 });
      await page.getByTestId("auth-submit").click({ timeout: 15_000 });
      await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
    } else {
      await page.getByRole("textbox", { name: /corporation email/i }).fill(email);
      await page.getByRole("textbox", { name: /password/i }).fill(password);
      await page.getByRole("button", { name: /secure sign in/i }).click();
      await page.waitForTimeout(8_000);
    }

    if (license) {
      const lic = page.getByPlaceholder("XXXX-XXXX-XXXX-XXXX");
      if (await lic.isVisible().catch(() => false)) {
        await lic.fill(license);
        await page.getByRole("button", { name: /activate/i }).click();
        await page.waitForTimeout(4_000);
      }
    }

    await page.goto("/app", { timeout: 60_000, waitUntil: "domcontentloaded" });
    await dismissCookieBanner(page);
    await page
      .getByRole("menubar", { name: /Offline ERP main menu/i })
      .waitFor({ state: "visible", timeout: 45_000 })
      .catch(() => {});
    await page.waitForTimeout(3_000);

    if (await page.getByTestId("auth-form").isVisible().catch(() => false)) {
      result.error = "Still on auth form after login — session not established";
    }

    const body = await page.locator("body").innerText();
    result.bodySample = body.slice(0, 1200).replace(/\s+/g, " ");
    result.groups = EXPECTED_GROUPS.filter((g) => new RegExp(g.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(body));
    result.missingGroups = EXPECTED_GROUPS.filter((g) => !result.groups.includes(g));
    result.hasStaging = /staging/i.test(body);
    result.hasBadLabels = /Home Grouped|Master Group/i.test(body);
    result.ok = result.groups.length >= 10 && !result.hasStaging && !result.hasBadLabels;
  } catch (e) {
    result.error = e instanceof Error ? e.message : String(e);
  } finally {
    await browser.close();
  }
  return result;
}

const captures = [];
for (const t of TARGETS) {
  console.log("Capturing", t.id, t.baseURL);
  captures.push({ id: t.id, ...(await loginAndCapture(t.baseURL)) });
}

const report = {
  at: new Date().toISOString(),
  email: email.replace(/(.{2}).+(@)/, "$1***$2"),
  expectedGroups: EXPECTED_GROUPS,
  captures,
  match:
    captures.length === 2 &&
    captures[0].groups?.join() === captures[1].groups?.join() &&
    captures.every((c) => c.ok),
};

fs.writeFileSync("_reconstruction/parity-sidebar-compare.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ match: report.match, captures: captures.map((c) => ({ id: c.id, ok: c.ok, groups: c.groups?.length, missing: c.missingGroups, error: c.error })) }, null, 2));
process.exit(report.match ? 0 : 1);
