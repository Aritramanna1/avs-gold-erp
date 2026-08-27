#!/usr/bin/env node
/**
 * One-shot: upload existing dist/ to Hostinger using .cursor/secrets token.
 * Does not rebuild. Keeps secrets out of argv.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv(file) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) return;
  for (const line of fs.readFileSync(full, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnv(".env");
loadEnv(".env.production.local");

const secretRaw = fs
  .readFileSync(path.join(root, ".cursor/secrets/hostinger-api-token.json"), "utf8")
  .replace(/^\uFEFF/, "");
const secret = JSON.parse(secretRaw);
const token = secret.token;
const username = secret.username || "u190341181";
const DOMAIN = secret.domain || "maatarajewellers.shop";

console.log(`Uploading dist/ → ${DOMAIN} as ${username}`);

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
      files.push({
        fullPath,
        relativePath: path.relative(baseDir, fullPath).replace(/\\/g, "/"),
      });
  }
  return files;
}

const distFiles = await getFiles(path.join(root, "dist"));
let count = 0;
let fail = 0;
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
    const patch = await fetch(targetFileUrl, {
      method: "PATCH",
      headers: { ...headers, "Content-Type": "application/offset+octet-stream" },
      body: fileBuffer,
    });
    if (!patch.ok && patch.status !== 204) fail++;
  } else {
    fail++;
  }
  if (count % 25 === 0 || count === distFiles.length) {
    console.log(`  Uploaded ${count}/${distFiles.length} (fail=${fail})`);
  }
}

const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
const m = html.match(/assets\/(index-[^"']+\.js)/);
console.log(
  `DONE. Built asset=${m?.[1] ?? "unknown"} fails=${fail}. Rollback SoT remains dist_go_20260826_190800.zip (CVsE73i6) — do not replace.`,
);
