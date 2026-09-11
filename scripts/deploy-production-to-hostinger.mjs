import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const secretPath = path.join(root, '.cursor/secrets/hostinger-api-token.json');
const secret = JSON.parse(fs.readFileSync(secretPath, 'utf8').replace(/^\uFEFF/, ''));

const token = secret.token;
const username = secret.username || 'u190341181';
const distDir = path.join(root, 'dist');

const TARGET_DOMAINS = ['erp.arivahly.in', 'arivahly.in'];

async function getFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getFiles(fullPath, baseDir));
    } else {
      files.push({ fullPath, relativePath: path.relative(baseDir, fullPath).replace(/\\/g, '/') });
    }
  }
  return files;
}

async function uploadToDomain(domain) {
  console.log(`\n==================================================================`);
  console.log(`  Deploying to Hostinger: ${domain}`);
  console.log(`==================================================================`);

  const distFiles = await getFiles(distDir);
  console.log(`Total files to upload: ${distFiles.length}`);

  const resCreds = await fetch("https://developers.hostinger.com/api/hosting/v1/files/upload-urls", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ username, domain }),
  });

  if (!resCreds.ok) {
    throw new Error(`Failed to get upload credentials for ${domain}: ${resCreds.status} ${await resCreds.text()}`);
  }

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
            await new Promise((r) => setTimeout(r, 1000 * attempt));
            return uploadOne(file, attempt + 1);
          }
          return false;
        }
        return true;
      }
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
        return uploadOne(file, attempt + 1);
      }
      return false;
    } catch {
      if (attempt < 4) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
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
      const ok = await uploadOne(file);
      if (!ok) fail++;
      if (count % 25 === 0 || count === distFiles.length) {
        console.log(`  [${count}/${distFiles.length}] Uploaded (${fail} errors)`);
      }
    }
  }

  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`\nDeployment to ${domain} finished with ${fail} errors.`);
  return fail;
}

async function main() {
  console.log("==================================================================");
  console.log("  AVS ERP — PRODUCTION DEPLOYMENT TO HOSTINGER                    ");
  console.log("==================================================================");

  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error("dist/index.html not found! Run npm run build first.");
    process.exit(1);
  }

  let totalErrors = 0;
  for (const domain of TARGET_DOMAINS) {
    const errs = await uploadToDomain(domain);
    totalErrors += errs;
  }

  console.log("\n==================================================================");
  console.log(`  ALL DEPLOYMENTS COMPLETED (Total Errors: ${totalErrors})`);
  console.log("==================================================================\n");

  // Verify live endpoint
  try {
    const liveRes = await fetch('https://erp.arivahly.in', { method: 'GET' });
    console.log(`Live site check (https://erp.arivahly.in): HTTP ${liveRes.status}`);
  } catch (e) {
    console.log(`Live site check error: ${e.message}`);
  }
}

main().catch(console.error);
