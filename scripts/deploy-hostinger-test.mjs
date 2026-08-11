import fs from "fs";
import path from "path";

const token = "fbW3w8zUafTHG0xCZEjOJVKf45OXckUqVB2ymmjl4bee4e56";
const targetDomain = "avs-erp-preview-20260806.hostingersite.com";
const username = "u190341181";

async function getFiles(dir, baseDir = dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files = files.concat(await getFiles(fullPath, baseDir));
    } else {
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
      files.push({ fullPath, relativePath });
    }
  }
  return files;
}

async function uploadToHostingerPreview() {
  console.log(`📡 Fetching File Upload Credentials for ${targetDomain}...`);

  const resCreds = await fetch(
    "https://developers.hostinger.com/api/hosting/v1/files/upload-urls",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, domain: targetDomain }),
    },
  );

  if (resCreds.status !== 200) {
    throw new Error(`Failed to get credentials: ${resCreds.status} ${await resCreds.text()}`);
  }

  const {
    url: uploadUrl,
    auth_key: authToken,
    rest_auth_key: authRestToken,
  } = await resCreds.json();
  const cleanUrl = uploadUrl.replace(/\/$/, "");

  console.log(`✅ Upload Credentials Received! Upload Target URL: ${cleanUrl}`);

  const distFiles = await getFiles(path.resolve("dist"));
  console.log(`📦 Found ${distFiles.length} production files to deploy...`);

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

    // Pre-flight post
    const preflight = await fetch(targetFileUrl, {
      method: "POST",
      headers,
    });

    if (preflight.status === 201 || preflight.status === 200 || preflight.status === 204) {
      // Upload body
      await fetch(targetFileUrl, {
        method: "PATCH",
        headers: {
          ...headers,
          "Content-Type": "application/offset+octet-stream",
        },
        body: fileBuffer,
      });
    }

    if (count % 10 === 0 || count === distFiles.length) {
      console.log(
        `🚀 Upload Progress: ${count} / ${distFiles.length} files deployed (${file.relativePath})...`,
      );
    }
  }

  console.log(`🎉 DEPLOYMENT COMPLETE! Site deployed to testing domain: https://${targetDomain}`);
}

uploadToHostingerPreview().catch((err) => {
  console.error("❌ Deployment Failed:", err);
  process.exit(1);
});
