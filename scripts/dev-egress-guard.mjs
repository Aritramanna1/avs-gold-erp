/**
 * Refuses to start Vite dev server against production Supabase unless opted in.
 * Prevents continuous REST/Auth/Realtime egress from localhost → production.
 */
import fs from "fs";
import path from "path";

const PRODUCTION_REF = "dqgrrafuoxaorvyrcuuh";

function loadEnvFile(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

const root = process.cwd();
const env = {
  ...loadEnvFile(path.join(root, ".env")),
  ...loadEnvFile(path.join(root, ".env.local")),
  ...process.env,
};

const url = env.VITE_SUPABASE_URL ?? "";
const projectId = env.VITE_SUPABASE_PROJECT_ID ?? "";
const pointsAtProd =
  url.includes(PRODUCTION_REF) || projectId === PRODUCTION_REF;

if (pointsAtProd && env.VITE_ENABLE_DEV_SUPABASE !== "1") {
  console.error(`
╔══════════════════════════════════════════════════════════════════════╗
║  BLOCKED: npm run dev → production Supabase (${PRODUCTION_REF})     ║
║                                                                      ║
║  This causes continuous API/Auth egress and has already exceeded     ║
║  the Free Plan (10.6 GB used).                                       ║
║                                                                      ║
║  UI-only (no live DB):  npm run preview:shop                         ║
║  Cloud dev (owner):     set VITE_ENABLE_DEV_SUPABASE=1 in shell      ║
║                         (never commit; never in .env.local in git)   ║
╚══════════════════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}
