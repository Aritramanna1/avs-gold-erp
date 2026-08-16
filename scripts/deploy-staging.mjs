#!/usr/bin/env node
/**
 * Build and deploy Ornexa to Hostinger STAGING ONLY.
 * Target: avs-erp-preview-20260806.hostingersite.com
 * NEVER deploys to maatarajewellers.shop (production).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const STAGING_DOMAIN = "avs-erp-preview-20260806.hostingersite.com";
const STAGING_URL = `https://${STAGING_DOMAIN}`;
const PRODUCTION_BLOCKED = ["maatarajewellers.shop"];

if (process.env.DEPLOY_TARGET?.includes("maatarajewellers")) {
  console.error("REFUSED: production domain is not a valid staging deploy target.");
  process.exit(2);
}

const stagingEnv = {
  VITE_DEFAULT_DEPLOYMENT_MODE: "online",
  VITE_FORCE_ONLINE: "true",
  VITE_APP_ENV: "staging",
  VITE_PUBLIC_APP_URL: STAGING_URL,
  VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  VITE_SUPABASE_PROJECT_ID: process.env.VITE_SUPABASE_PROJECT_ID,
  VITE_R2_PROXY_URL: process.env.VITE_R2_PROXY_URL,
  VITE_LICENSE_ENDPOINT: process.env.VITE_LICENSE_ENDPOINT,
  VITE_GOOGLE_OAUTH_ENABLED: "true",
};

for (const [key, value] of Object.entries(stagingEnv)) {
  if (!value) {
    console.error(`Missing required staging env: ${key}`);
    process.exit(1);
  }
}

console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  ORNEXA STAGING DEPLOY — NOT PRODUCTION                 ║");
console.log("╚══════════════════════════════════════════════════════════╝");
console.log(`Target: ${STAGING_URL}`);
console.log(`Supabase: ${stagingEnv.VITE_SUPABASE_URL}`);

console.log("\n[1/3] Building staging bundle…");
execSync("npm run build", {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, ...stagingEnv, NODE_ENV: "production" },
});

// Verify build does not embed production URL as primary app URL
const indexHtml = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
for (const blocked of PRODUCTION_BLOCKED) {
  if (indexHtml.includes(blocked)) {
    console.warn(`WARNING: dist/index.html references production host ${blocked}`);
  }
}

console.log("\n[2/3] Uploading to Hostinger staging…");
const token = process.env.HOSTINGER_API_TOKEN;
if (!token) {
  console.error(
    "HOSTINGER_API_TOKEN not set. Export token before running scripts/deploy-staging.mjs.",
  );
  process.exit(1);
}

const username = process.env.HOSTINGER_USERNAME || "u190341181";
const resCreds = await fetch("https://developers.hostinger.com/api/hosting/v1/files/upload-urls", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ username, domain: STAGING_DOMAIN }),
});
if (!resCreds.ok) {
  const errText = await resCreds.text();
  const zipName = `dist_staging_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.zip`;
  const zipPath = path.join(root, zipName);
  if (fs.existsSync(path.join(root, "dist"))) {
    execSync(
      process.platform === "win32"
        ? `powershell -NoProfile -Command "Compress-Archive -Path '${path.join(root, "dist", "*")}' -DestinationPath '${zipPath}' -Force"`
        : `cd dist && zip -r ../${zipName} .`,
      { cwd: root, stdio: "inherit" },
    );
    console.error(
      `\nHostinger upload failed (${resCreds.status}). Build artifact saved: ${zipName}`,
    );
    console.error("Upload manually via Hostinger File Manager or fix HOSTINGER_API_TOKEN.");
  }
  throw new Error(`Hostinger credentials failed: ${resCreds.status} ${errText}`);
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
  const preflight = await fetch(targetFileUrl, { method: "POST", headers });
  if (preflight.status === 201 || preflight.status === 200 || preflight.status === 204) {
    await fetch(targetFileUrl, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/offset+octet-stream" },
      body: fileBuffer,
    });
  }
  if (count % 20 === 0 || count === distFiles.length) {
    console.log(`  Uploaded ${count}/${distFiles.length} files…`);
  }
}

console.log("\n[3/3] Writing qa/config/qa.env for staging QA…");
const qaEnvPath = path.join(root, "qa/config/qa.env");
const qaEnv = `# AUTO-GENERATED by deploy-staging.mjs — ${new Date().toISOString()}
QA_BASE_URL=${STAGING_URL}
E2E_BASE_URL=${STAGING_URL}
VITE_APP_ENV=staging
VITE_PUBLIC_APP_URL=${STAGING_URL}
QA_SUPABASE_URL=${stagingEnv.VITE_SUPABASE_URL}
QA_ALLOW_PRODUCTION_TARGET=0
`;
fs.writeFileSync(qaEnvPath, qaEnv);

console.log(`\n✅ STAGING DEPLOY COMPLETE: ${STAGING_URL}`);
console.log("Next: configure Supabase Auth redirect URLs + Google OAuth for staging domain.");
console.log("Next: deploy R2 worker CORS update (workers/storage-proxy).");
console.log("Next: npm run qa:smoke with qa/config/qa.env loaded.");
