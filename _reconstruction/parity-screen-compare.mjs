/**
 * Side-by-side screen capture: localhost vs maatarajewellers.shop (authenticated QA).
 * Output: _reconstruction/parity-screen-compare.json
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
const email = process.env.E2E_EMAIL || env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD || env.E2E_PASSWORD;

const TARGETS = [
  { id: "localhost", baseURL: env.E2E_BASE_URL || "http://localhost:3000" },
  { id: "shop5190", baseURL: "https://maatarajewellers.shop" },
];

const ROUTES = [
  "/app",
  "/people",
  "/stock",
  "/orders",
  "/billing",
  "/ledger",
  "/workshop",
  "/reports",
  "/reports/gold-ledger",
  "/reports/sales-register",
  "/settings",
  "/barcode",
  "/utilities",
  "/mobile/work",
  "/mobile/business",
  "/mobile/reports",
  "/mobile/more",
  "/verify",
  "/customer-portal",
  "/login",
];

async function dismissCookieBanner(page) {
  const accept = page.getByRole("button", { name: /accept all|essential only/i });
  if (await accept.first().isVisible({ timeout: 2_000 }).catch(() => false)) {
    await accept.first().click();
    await page.waitForTimeout(400);
  }
}

async function login(page, baseURL, needsAuth) {
  await page.goto(`${baseURL}/login`, { timeout: 60_000, waitUntil: "domcontentloaded" });
  await dismissCookieBanner(page);
  if (!needsAuth) return;
  const emailEl = page.getByTestId("auth-email");
  if (await emailEl.count()) {
    await emailEl.fill(email, { timeout: 15_000 });
    await page.getByTestId("auth-password").fill(password, { timeout: 15_000 });
    await page.getByTestId("auth-submit").click({ timeout: 15_000 });
    await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 45_000 }).catch(() => {});
  }
}

function normalizeSample(text) {
  return text
    .replace(/\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?/gi, "")
    .replace(/ERR-\d+-[A-F0-9]+/gi, "ERR-REF")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

async function ensureAuthed(page, baseURL) {
  const authForm = page.getByTestId("auth-form");
  if (await authForm.isVisible({ timeout: 1_500 }).catch(() => false)) {
    await login(page, baseURL, true);
  }
}

async function captureTarget(target) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  const screens = [];

  try {
    const needsAuth = true;
    await login(page, target.baseURL, needsAuth);

    for (const route of ROUTES) {
      const entry = { route, title: null, ok: false, error: null, sample: null, hasCrash: false };
      try {
        const isMobileRoute = route.startsWith("/mobile");
        if (isMobileRoute) {
          await page.setViewportSize({ width: 390, height: 844 });
        } else if (route !== "/login" && route !== "/verify" && route !== "/customer-portal") {
          await page.setViewportSize({ width: 1400, height: 900 });
        }
        await page.goto(`${target.baseURL}${route}`, { timeout: 90_000, waitUntil: "domcontentloaded" });
        await dismissCookieBanner(page);
        await ensureAuthed(page, target.baseURL);
        if (!route.startsWith("/login") && !route.startsWith("/verify") && !route.startsWith("/customer-portal")) {
          await page.waitForSelector("body", { state: "attached", timeout: 15_000 });
        }
        await page.waitForTimeout(isMobileRoute ? 3_000 : route.includes("/reports") ? 4_000 : 2_000);
        entry.title = await page.title();
        const body = await page.locator("body").innerText();
        entry.sample = normalizeSample(body);
        entry.hasCrash = /something went wrong|couldn't load this section|this page hit an error/i.test(
          body,
        );
        entry.ok = body.length > 30 && !entry.hasCrash;
      } catch (e) {
        entry.error = e instanceof Error ? e.message : String(e);
      }
      screens.push(entry);
    }
  } finally {
    await browser.close();
  }
  return { id: target.id, baseURL: target.baseURL, screens };
}

if (!email || !password) {
  console.error("Missing E2E credentials");
  process.exit(1);
}

const captures = [];
for (const t of TARGETS) {
  console.log("Screen capture", t.id);
  captures.push(await captureTarget(t));
}

const comparisons = ROUTES.map((route) => {
  const a = captures[0]?.screens.find((s) => s.route === route);
  const b = captures[1]?.screens.find((s) => s.route === route);
  const titleMatch = a?.title && b?.title ? a.title === b.title : null;
  const bothOk = !!(a?.ok && b?.ok);
  return { route, localhostOk: a?.ok, shopOk: b?.ok, titleMatch, bothOk, localhostCrash: a?.hasCrash, shopCrash: b?.hasCrash };
});

const report = {
  at: new Date().toISOString(),
  routes: ROUTES.length,
  comparisons,
  captures,
  matchRate: comparisons.filter((c) => c.bothOk).length / ROUTES.length,
  titleMatchRate: comparisons.filter((c) => c.titleMatch === true).length / ROUTES.length,
};

fs.writeFileSync("_reconstruction/parity-screen-compare.json", JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    matchRate: report.matchRate,
    ok: comparisons.filter((c) => c.bothOk).length,
    crashes: comparisons.filter((c) => c.localhostCrash || c.shopCrash).length,
  }),
);
process.exit(comparisons.every((c) => c.bothOk && !c.localhostCrash && !c.shopCrash) ? 0 : 1);
