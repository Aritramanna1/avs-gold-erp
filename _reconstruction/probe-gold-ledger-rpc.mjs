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

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email: env.E2E_EMAIL, password: env.E2E_PASSWORD }),
});
const tok = (await auth.json()).access_token;
const body = {
  p_bucket: null,
  p_purity: null,
  p_type: null,
  p_from: null,
  p_to: null,
  p_limit: 1,
  p_offset: 0,
};
const res = await fetch(`${url}/rest/v1/rpc/get_gold_ledger_page`, {
  method: "POST",
  headers: {
    apikey: anon,
    Authorization: `Bearer ${tok}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
console.log(JSON.stringify({ status: res.status, body: text.slice(0, 500) }, null, 2));
