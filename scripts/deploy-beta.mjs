#!/usr/bin/env node
/**
 * Deploy Ornexa public beta to maatarajewellers.shop (current test domain).
 * Set VITE_PUBLIC_APP_URL when moving to a new domain — no code changes required.
 *
 * Requires: HOSTINGER_API_TOKEN, Supabase env vars, VITE_LICENSE_ENDPOINT
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const DOMAIN = process.env.DEPLOY_DOMAIN || "maatarajewellers.shop";
const SITE_URL = `https://${DOMAIN.replace(/^https?:\/\//, "")}`;

const buildEnv = {
  VITE_DEFAULT_DEPLOYMENT_MODE: "online",
  VITE_FORCE_ONLINE: "true",
  VITE_APP_ENV: process.env.VITE_APP_ENV || "beta",
  VITE_PUBLIC_APP_URL: SITE_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID,
  VITE_R2_PROXY_URL: process.env.VITE_R2_PROXY_URL,
  VITE_LICENSE_ENDPOINT: process.env.VITE_LICENSE_ENDPOINT,
  VITE_GOOGLE_OAUTH_ENABLED: process.env.VITE_GOOGLE_OAUTH_ENABLED || "true",
};

for (const [key, value] of Object.entries(buildEnv)) {
  if (!value) {
    console.error(`Missing required env: ${key}`);
    process.exit(1);
  }
}

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  ORNEXA BETA DEPLOY — maatarajewellers.shop (test domain) ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`Target: ${SITE_URL}`);

console.log("\n[1/4] Generating sitemap…");
execSync("node scripts/generate-sitemap.mjs", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_PUBLIC_APP_URL: SITE_URL },
});

console.log("\n[2/4] Building bundle…");
execSync("npm run build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...buildEnv, NODE_ENV: "production" },
});

execSync("node scripts/generate-sitemap.mjs", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, VITE_PUBLIC_APP_URL: SITE_URL },
});

const token = process.env.HOSTINGER_API_TOKEN;
if (!token) {
  console.error("HOSTINGER_API_TOKEN not set — build complete, upload skipped.");
  process.exit(0);
}

console.log("\n[3/4] Uploading to Hostinger…");
const username = process.env.HOSTINGER_USERNAME || "u190341181";
const resCreds = await fetch("https://developers.hostinger.com/api/hosting/v1/files/upload-urls", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ username, domain: DOMAIN }),
});
if (!resCreds.ok) {
  throw new Error(`Hostinger credentials failed: ${resCreds.status} ${await resCreds.text()}`);
}
const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = await resCreds.json();
const cleanUrl = uploadUrl.replace(/\/$/, "");

async function getFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(await getFiles(fullPath, baseDir));
    else
      files.push({ fullPath, relativePath: path.relative(baseDir, fullPath).replace(/\\/g, "/") });
  }
  return files;
}

const distFiles = await getFiles(path.join(root, "dist"));
let count = 0;
for (const file of distFiles) {
  count++;
  const fileStats = fs.statSync(file.fullPath);
  const fileBuffer = fs.readFileSync(file.fullPath);
  const targetFileUrl = `${cleanUrl}/${file.relativePath}?override=true`;
  const headers = {
    "X-Auth": authToken,
    "X-Auth-Rest": authRestToken,
    "upload-length": fileStats.size.toString(),
    "upload-offset": "0",
  };
  let uploaded = false;
  for (let attempt = 1; attempt <= 4 && !uploaded; attempt++) {
    try {
      const preflight = await fetch(targetFileUrl, { method: "POST", headers });
      if (preflight.status === 201 || preflight.status === 200 || preflight.status === 204) {
        await fetch(targetFileUrl, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/offset+octet-stream" },
          body: fileBuffer,
        });
      }
      uploaded = true;
    } catch (err) {
      if (attempt === 4) throw err;
      await new Promise((r) => setTimeout(r, attempt * 600));
    }
  }
  if (count % 25 === 0 || count === distFiles.length) {
    console.log(`  Uploaded ${count}/${distFiles.length}…`);
  }
}

const zipName = `dist_beta_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;
console.log(`\n[4/4] ✅ BETA DEPLOY COMPLETE: ${SITE_URL}`);
console.log(`Canonical URL env for future domain: VITE_PUBLIC_APP_URL=${SITE_URL}`);
