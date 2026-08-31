/**
 * A–Z HTTP smoke against local Vite — 3 rounds.
 * Status 200/302/303/307/308 count as route-alive; >=500 or network error = fail.
 * Does NOT prove authenticated business parity.
 */
const paths = [
  // public website
  "/",
  "/login",
  "/pricing",
  "/about",
  "/contact",
  "/features",
  "/product",
  "/support",
  "/solutions/retail",
  "/blog",
  "/legal/privacy",
  "/verify",
  "/unsubscribe/test-token",
  "/doc/test-token",
  // ERP shell
  "/app",
  "/billing",
  "/ledger",
  "/people",
  "/workshop",
  "/workshop/gold-book",
  "/workshop/dhadi-groups",
  "/workshop/jangad",
  "/workshop/karigar-book",
  "/workshop/vibrator",
  "/transactions",
  "/reports",
  "/reports/gold-loss",
  "/reports/fine-rojmel",
  "/reports/sales-register",
  "/reports/reconciliation-center",
  "/inventory",
  "/manufacturing",
  "/orders",
  "/settings",
  "/utilities",
  "/scheme",
  // portals
  "/customer-portal",
  "/karigar-portal",
  "/jeweller-portal",
  "/supplier-portal",
  // mobile
  "/mobile/work",
  "/mobile/business",
  "/mobile/reports",
  "/mobile/more",
  "/mobile/sync",
  "/mobile/gold-stock",
  "/mobile/transactions",
];

async function round(n) {
  const out = [];
  for (const p of paths) {
    const t0 = Date.now();
    try {
      const res = await fetch("http://localhost:3000" + p, { redirect: "manual" });
      out.push({
        path: p,
        status: res.status,
        ms: Date.now() - t0,
        loc: res.headers.get("location"),
      });
    } catch (e) {
      out.push({ path: p, error: String(e) });
    }
  }
  const bad = out.filter((r) => r.error || (r.status != null && r.status >= 500));
  console.log(
    "ROUND",
    n,
    "ok",
    out.length - bad.length,
    "/",
    out.length,
    "fail",
    bad.length,
    bad.length ? JSON.stringify(bad) : "",
  );
  return out;
}

const rounds = [];
for (let i = 1; i <= 3; i++) rounds.push(await round(i));
const fail = rounds.flat().filter((r) => r.error || (r.status != null && r.status >= 500));
const summary = {
  paths: paths.length,
  rounds: 3,
  failures: fail.length,
  sampleStatuses: Object.fromEntries(
    rounds[0].map((r) => [r.path, r.status ?? r.error]),
  ),
};
console.log("SUMMARY", JSON.stringify(summary, null, 2));
import("fs").then((fs) =>
  fs.writeFileSync("_reconstruction/smoke-az-local.json", JSON.stringify({ rounds, summary }, null, 2)),
);
process.exit(fail.length ? 1 : 0);
