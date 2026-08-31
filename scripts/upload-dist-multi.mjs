#!/usr/bin/env node
/** Upload dist/ to Aurum hosts only. Never maatarajewellers.shop.
 *  Owner-only: do not run unless explicitly requested in the current session.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secret = JSON.parse(
  fs.readFileSync(path.join(root, ".cursor/secrets/hostinger-api-token.json"), "utf8").replace(/^\uFEFF/, ""),
);
const token = secret.token;
const username = secret.username || "u190341181";
const BLOCKED = new Set(["maatarajewellers.shop", "www.maatarajewellers.shop"]);
const domains = process.argv.slice(2).filter(Boolean);
if (!domains.length) {
  console.error("Pass domains: aurum.arivahly.in aurumportal.arivahly.in aurum.erp.arivahly.in");
  process.exit(1);
}
for (const d of domains) {
  if (BLOCKED.has(d.toLowerCase())) {
    console.error(`REFUSED: never deploy to ${d}`);
    process.exit(1);
  }
}

async function getFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files = files.concat(await getFiles(fullPath, baseDir));
    else files.push({ fullPath, relativePath: path.relative(baseDir, fullPath).replace(/\\/g, "/") });
  }
  return files;
}

const SURFACE_DIST = {
  "aurum.arivahly.in": "dist-aurum",
  "www.aurum.arivahly.in": "dist-aurum",
  "aurum.erp.arivahly.in": "dist-erp",
  "erp.aurum.arivahly.in": "dist-erp",
  "aurumportal.arivahly.in": "dist-portal",
};

const distDir = (() => {
  if (process.argv.includes("--from-shop")) {
    return path.join(root, "production-dist-shop");
  }
  const domain = domains[0]?.toLowerCase();
  const surfaceDir = domain ? SURFACE_DIST[domain] : null;
  if (surfaceDir) {
    const resolved = path.join(root, surfaceDir);
    if (fs.existsSync(path.join(resolved, "index.html"))) return resolved;
  }
  return path.join(root, "dist");
})();
if (!fs.existsSync(path.join(distDir, "index.html"))) {
  console.error(`No index.html in ${distDir}`);
  process.exit(1);
}
const distFiles = await getFiles(distDir);

async function uploadDomain(DOMAIN) {
  console.log(`\n=== ${distFiles.length} files → ${DOMAIN} ===`);
  const resCreds = await fetch("https://developers.hostinger.com/api/hosting/v1/files/upload-urls", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ username, domain: DOMAIN }),
  });
  if (!resCreds.ok) throw new Error(`${DOMAIN}: ${resCreds.status} ${await resCreds.text()}`);
  const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = await resCreds.json();
  const cleanUrl = uploadUrl.replace(/\/$/, "");
  let fail = 0;
  let count = 0;
  const queue = [...distFiles];
  async function uploadOne(file, attempt = 1) {
    const fileBuffer = fs.readFileSync(file.fullPath);
    const targetFileUrl = `${cleanUrl}/${file.relativePath}?override=true`;
    const headers = {
      "X-Auth": authToken,
      "X-Auth-Rest": authRestToken,
      "upload-length": fileBuffer.length.toString(),
      "upload-offset": "0",
    };
    try {
      const preflight = await fetch(targetFileUrl, { method: "POST", headers });
      if (preflight.status === 201 || preflight.status === 200 || preflight.status === 204) {
        const patch = await fetch(targetFileUrl, {
          method: "PATCH",
          headers: { ...headers, "Content-Type": "application/offset+octet-stream" },
          body: fileBuffer,
        });
        if (!patch.ok && patch.status !== 204) {
          if (attempt < 4) {
            await new Promise((r) => setTimeout(r, 1500 * attempt));
            return uploadOne(file, attempt + 1);
          }
          return false;
        }
        return true;
      }
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        return uploadOne(file, attempt + 1);
      }
      return false;
    } catch {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 2000 * attempt));
        return uploadOne(file, attempt + 1);
      }
      return false;
    }
  }
  async function worker() {
    while (queue.length) {
      const file = queue.shift();
      if (!file) return;
      count++;
      if (!(await uploadOne(file))) fail++;
      if (count % 40 === 0) console.log(`  ${DOMAIN} ${count}/${distFiles.length} fail=${fail}`);
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`DONE ${DOMAIN} fails=${fail}`);
  return fail;
}

let totalFail = 0;
for (const d of domains) totalFail += await uploadDomain(d);
const html = fs.readFileSync(path.join(distDir, "index.html"), "utf8");
const m = html.match(/assets\/(index-[^"']+\.js)/);
console.log(`\nBundle ${m?.[1] ?? "?"} from ${path.basename(distDir)} totalFails=${totalFail}`);
process.exit(totalFail ? 1 : 0);
