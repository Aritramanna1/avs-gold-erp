import fs from "node:fs";

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
const url = env.VITE_SUPABASE_URL || env.QA_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = env.E2E_EMAIL;
const pass = env.E2E_PASSWORD;

if (!url || !key || !email || !pass) {
  console.error("Missing env");
  process.exit(1);
}

const authRes = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: key, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: pass }),
});
const authText = await authRes.text();
console.log("AUTH", authRes.status, authText.slice(0, 500));
if (authRes.status !== 200) process.exit(1);

const { access_token: token } = JSON.parse(authText);

for (const rpc of ["get_authorization_context", "get_my_memberships"]) {
  const res = await fetch(`${url}/rest/v1/rpc/${rpc}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: "{}",
  });
  const text = await res.text();
  console.log(`RPC ${rpc}`, res.status, text.slice(0, 800));
}
