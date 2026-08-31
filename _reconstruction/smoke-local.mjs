const paths = ["/", "/login", "/pricing", "/about", "/app", "/billing", "/ledger", "/people", "/workshop", "/reports", "/verify", "/customer-portal", "/settings"];
async function round(n) {
  const out = [];
  for (const p of paths) {
    const t0 = Date.now();
    try {
      const res = await fetch("http://localhost:3000" + p, { redirect: "manual" });
      out.push({ path: p, status: res.status, ms: Date.now() - t0, loc: res.headers.get("location") });
    } catch (e) {
      out.push({ path: p, error: String(e) });
    }
  }
  console.log("ROUND", n, JSON.stringify(out));
  return out;
}
const rounds = [];
for (let i = 1; i <= 3; i++) rounds.push(await round(i));
const fail = rounds.flat().filter(r => r.error || (r.status >= 500));
console.log("failures", fail.length);
