#!/usr/bin/env node
/**
 * Restore Hostinger from a local dist zip (e.g. GO rollback).
 * Usage: node scripts/restore-hostinger-from-zip.mjs dist_go_20260826_190800.zip
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zipArg = process.argv[2];
if (!zipArg) {
  console.error("Usage: node scripts/restore-hostinger-from-zip.mjs <zip>");
  process.exit(1);
}
const zipPath = path.isAbsolute(zipArg) ? zipArg : path.join(root, zipArg);
if (!fs.existsSync(zipPath)) {
  console.error("Zip not found:", zipPath);
  process.exit(1);
}

const secretRaw = fs
  .readFileSync(path.join(root, ".cursor/secrets/hostinger-api-token.json"), "utf8")
  .replace(/^\uFEFF/, "");
const secret = JSON.parse(secretRaw);
const token = secret.token;
const username = secret.username || "u190341181";
const DOMAIN = secret.domain || "maatarajewellers.shop";

const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), "avs-go-restore-"));
console.log("Extracting", path.basename(zipPath), "→", extractDir);
execSync(`tar -xf "${zipPath}" -C "${extractDir}"`, { stdio: "inherit" });

const indexHtml = fs.readFileSync(path.join(extractDir, "index.html"), "utf8");
const m = indexHtml.match(/assets\/(index-[^"']+\.js)/);
console.log("Bundle in zip:", m?.[1] ?? "unknown");
console.log(`Uploading → ${DOMAIN} as ${username}`);

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

const distFiles = await getFiles(extractDir);
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
  if (count % 50 === 0 || count === distFiles.length) {
    console.log(`  Uploaded ${count}/${distFiles.length} (fail=${fail})`);
  }
}

console.log(`DONE restore. expected=${m?.[1]} fails=${fail}`);
fs.rmSync(extractDir, { recursive: true, force: true });
