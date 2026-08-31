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
const env = { ...loadEnv(".env.local") };
const url = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;

const res = await fetch(url + "/rest/v1/", {
  headers: {
    apikey: key,
    Authorization: "Bearer " + key,
    Accept: "application/openapi+json",
  },
});
console.log("status", res.status, "ct", res.headers.get("content-type"));
const text = await res.text();
console.log("body start", text.slice(0, 200));
let spec;
try { spec = JSON.parse(text); } catch { console.log("not json"); process.exit(1); }
const paths = Object.keys(spec.paths || {})
  .filter((p) => p.startsWith("/rpc/"))
  .map((p) => p.slice(5))
  .sort();
console.log("rpc count", paths.length);
const shop = fs.readFileSync("_reconstruction/shop-rpc-list.txt", "utf8").split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
const set = new Set(paths);
const missingShop = shop.filter((r) => !set.has(r));
console.log("shop-not-live", missingShop.length);
missingShop.slice(0,40).forEach((x) => console.log(" -", x));
fs.writeFileSync("_reconstruction/supabase-live-rpcs.json", JSON.stringify({ url, paths, missingShop }, null, 2));
