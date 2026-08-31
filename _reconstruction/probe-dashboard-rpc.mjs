import fs from "fs";

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
const url = env.QA_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD }),
});
const authBody = await authRes.json();
const token = authBody.access_token;
if (!token) {
  console.error("auth failed", authRes.status, authBody);
  process.exit(1);
}

const rpcRes = await fetch(`${url}/rest/v1/rpc/get_home_dashboard_summary`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: "{}",
});
const text = await rpcRes.text();
console.log(JSON.stringify({ status: rpcRes.status, body: text.slice(0, 500) }, null, 2));
