/**
 * Probe billing print route console + DOM for parity debugging.
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
const baseURL = env.E2E_BASE_URL || "http://localhost:3000";
const liveIds = JSON.parse(fs.readFileSync("_reconstruction/live-ids.json", "utf8"));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ baseURL });
const logs = [];
page.on("console", (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto("/login");
const accept = page.getByRole("button", { name: /accept all|essential only/i });
if (await accept.first().isVisible().catch(() => false)) await accept.first().click();
await page.getByTestId("auth-email").fill(env.E2E_EMAIL);
await page.getByTestId("auth-password").fill(env.E2E_PASSWORD);
await page.getByTestId("auth-submit").click();
await page.getByTestId("auth-form").waitFor({ state: "hidden", timeout: 45_000 });

await page.goto("/billing");
await page.waitForTimeout(5_000);
let invoiceId = liveIds?.invoice?.id;
const links = page.locator('a[href^="/billing/"]');
for (let i = 0; i < (await links.count()); i++) {
  const href = await links.nth(i).getAttribute("href");
  const m = href?.match(/^\/billing\/(inv_[a-z0-9_]+)$/i);
  if (m) {
    invoiceId = m[1];
    break;
  }
}

console.log("invoiceId", invoiceId);
await page.goto(`/billing/print/${invoiceId}`);
await page.waitForTimeout(8_000);

const body = await page.locator("body").innerText();
const hasPrintRoot = (await page.getByTestId("print-layout-root").count()) > 0;
const hasQR = (await page.getByAltText("Verification QR").count()) > 0;
const hasError = /couldn.t load this section|invoice loading failure/i.test(body);

console.log(JSON.stringify({ hasPrintRoot, hasQR, hasError, bodySample: body.slice(0, 800) }, null, 2));
console.log("--- console ---");
console.log(logs.filter((l) => /error|ERR-|throw|fail/i.test(l)).slice(-30).join("\n"));

await browser.close();
