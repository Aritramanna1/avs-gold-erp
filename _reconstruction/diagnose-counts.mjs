import fs from "fs";
function loadEnv(p) {
  const o = {};
  if (!fs.existsSync(p)) return o;
  for (const l of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) o[m[1]] = m[2];
  }
  return o;
}
const env = { ...loadEnv(".env.local"), ...loadEnv(".env.e2e") };
const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD }),
});
const { access_token } = await auth.json();
const firm = "f9f73cce-9538-4286-9754-530ca4581fbb";
for (const t of ["orders", "job_cards", "gold_ledger", "stock_movements"]) {
  const r = await fetch(`${url}/rest/v1/${t}?select=id&firm_id=eq.${firm}`, {
    headers: { apikey: anon, Authorization: `Bearer ${access_token}`, Prefer: "count=exact" },
  });
  const text = await r.text();
  console.log(JSON.stringify({ t, status: r.status, range: r.headers.get("content-range"), snippet: text.slice(0, 150) }));
}
