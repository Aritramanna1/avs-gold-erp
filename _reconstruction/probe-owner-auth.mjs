import fs from "fs";

function loadEnv(p) {
  const out = { ...process.env };
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv(".env.local");
const url = env.QA_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY;
const email = process.env.E2E_EMAIL || env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD || env.E2E_PASSWORD;

if (!email || !password) {
  console.error("Set E2E_EMAIL and E2E_PASSWORD");
  process.exit(1);
}

const auth = await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: anon, "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
const body = await auth.json();
console.log(
  JSON.stringify(
    {
      status: auth.status,
      authenticated: !!body.access_token,
    },
    null,
    2,
  ),
);
process.exit(body.access_token ? 0 : 1);
