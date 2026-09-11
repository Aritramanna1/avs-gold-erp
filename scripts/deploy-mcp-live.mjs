import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const secretFile = path.join(root, '.cursor/secrets/hostinger-api-token.json');

if (!fs.existsSync(secretFile)) {
  console.error('Secret file not found:', secretFile);
  process.exit(1);
}

const secret = JSON.parse(fs.readFileSync(secretFile, 'utf8').replace(/^\uFEFF/, ''));
const token = secret.token;
const username = secret.username || 'u190341181';
const DOMAIN = 'erp.arivahly.in';

const filesToUpload = [
  {
    localPath: path.join(root, 'public/api/mcp/index.php'),
    remotePath: 'public_html/api/mcp/index.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/oauth-service.php'),
    remotePath: 'public_html/api/oauth/oauth-service.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/authorize.php'),
    remotePath: 'public_html/api/oauth/authorize.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/token.php'),
    remotePath: 'public_html/api/oauth/token.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/revoke.php'),
    remotePath: 'public_html/api/oauth/revoke.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/jwks.php'),
    remotePath: 'public_html/api/oauth/jwks.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/userinfo.php'),
    remotePath: 'public_html/api/oauth/userinfo.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/register.php'),
    remotePath: 'public_html/api/oauth/register.php'
  },
  {
    localPath: path.join(root, 'public/api/oauth/well-known.php'),
    remotePath: 'public_html/api/oauth/well-known.php'
  },
  {
    localPath: path.join(root, 'public/api/documents/verify.php'),
    remotePath: 'public_html/api/documents/verify.php'
  },
  {
    localPath: path.join(root, 'public/.htaccess'),
    remotePath: 'public_html/.htaccess'
  }
];

async function deploy() {
  console.log(`Getting upload URLs for ${DOMAIN}...`);
  const resCreds = await fetch('https://developers.hostinger.com/api/hosting/v1/files/upload-urls', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, domain: DOMAIN }),
  });

  if (!resCreds.ok) {
    throw new Error(`Failed to get credentials: ${resCreds.status} ${await resCreds.text()}`);
  }

  const { url: uploadUrl, auth_key: authToken, rest_auth_key: authRestToken } = await resCreds.json();
  const cleanUrl = uploadUrl.replace(/\/$/, '');

  for (const item of filesToUpload) {
    if (!fs.existsSync(item.localPath)) {
      console.error(`Local file not found: ${item.localPath}`);
      continue;
    }

    const fileBuffer = fs.readFileSync(item.localPath);
    // On Hostinger, relativePath might be relative to domain root, e.g. api/mcp/index.php or public_html/api/mcp/index.php
    // Let's test both or target relative to webroot (api/mcp/index.php)
    const relPath = item.remotePath.replace(/^public_html\//, '');
    const targetUrl = `${cleanUrl}/${relPath}?override=true`;

    const headers = {
      'X-Auth': authToken,
      'X-Auth-Rest': authRestToken,
      'upload-length': fileBuffer.length.toString(),
      'upload-offset': '0',
    };

    console.log(`Uploading ${item.localPath} -> ${targetUrl} (${fileBuffer.length} bytes)...`);
    const preflight = await fetch(targetUrl, { method: 'POST', headers });
    if (preflight.status === 201 || preflight.status === 200 || preflight.status === 204) {
      const patch = await fetch(targetUrl, {
        method: 'PATCH',
        headers: { ...headers, 'Content-Type': 'application/offset+octet-stream' },
        body: fileBuffer,
      });
      if (patch.ok || patch.status === 204) {
        console.log(`  SUCCESS: ${relPath}`);
      } else {
        console.error(`  PATCH failed: ${patch.status} ${await patch.text()}`);
      }
    } else {
      console.error(`  Preflight failed: ${preflight.status} ${await preflight.text()}`);
    }
  }

  console.log('\nDeployment finished.');
}

deploy().catch(err => {
  console.error('Deployment error:', err);
  process.exit(1);
});
