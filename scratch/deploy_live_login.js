import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import archiver from 'archiver';

function createZip(sourceDir, outPath) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    output.on('close', () => {
      console.log(`Zip archive created: ${archive.pointer()} bytes`);
      resolve();
    });

    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);

    const htaccessContent = fs.readFileSync('hostinger-htaccess.txt', 'utf8');
    archive.append(htaccessContent, { name: '.htaccess' });
    if (fs.existsSync('.env')) {
      archive.append(fs.readFileSync('.env', 'utf8'), { name: '.env' });
    }
    if (fs.existsSync('.env.production')) {
      archive.append(fs.readFileSync('.env.production', 'utf8'), { name: '.env.production' });
    }

    archive.finalize();
  });
}

function callHostingerMcp(tool, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('npx.cmd', ['--package=hostinger-api-mcp@latest', 'hostinger-hosting-mcp'], {
      shell: true,
      env: {
        ...process.env,
        HOSTINGER_API_TOKEN: 'mgQEuN4ZaKVMXlF5oKWnpGIk0X8zXkgiGo608gOr3068a9a0',
        API_TOKEN: 'mgQEuN4ZaKVMXlF5oKWnpGIk0X8zXkgiGo608gOr3068a9a0'
      }
    });

    let buffer = '';
    proc.stdout.on('data', (d) => {
      buffer += d.toString();
      const lines = buffer.split('\n');
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            const parsed = JSON.parse(line.trim());
            if (parsed.result && parsed.result.content) {
              const text = parsed.result.content[0].text;
              proc.kill();
              return resolve(JSON.parse(text));
            }
          } catch {}
        }
      }
    });

    proc.stderr.on('data', (d) => {
      const s = d.toString();
      if (s.includes('ERROR')) console.error('MCP STDERR:', s.trim());
    });

    proc.on('error', reject);

    const req = JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: tool, arguments: args }
    }) + '\n';

    proc.stdin.write(req);

    setTimeout(() => {
      proc.kill();
      reject(new Error(`Timeout calling ${tool}`));
    }, 60000);
  });
}

async function main() {
  console.log('=== BUILD & DEPLOY FIXED LOGIN UI TO HOSTINGER ===');
  const zipFile = path.resolve('erp-arivahly-production-deploy.zip');
  if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
  await createZip(path.resolve('dist'), zipFile);

  console.log('1. Fetching upload endpoint...');
  const uploadInfo = await callHostingerMcp('hosting_generateUploadURLV1', {
    username: 'u190341181',
    domain: 'erp.arivahly.in'
  });
  console.log('Upload Endpoint:', uploadInfo.url);

  const zipData = fs.readFileSync(zipFile);
  const targetFileUrl = `${uploadInfo.url}/deploy.zip?override=true`;

  console.log('2. Creating TUS upload slot on Hostinger...');
  const postRes = await fetch(targetFileUrl, {
    method: 'POST',
    headers: {
      'X-Auth': uploadInfo.auth_key,
      'X-Auth-Rest': uploadInfo.rest_auth_key,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(zipData.length),
      'Upload-Offset': '0'
    }
  });
  console.log('TUS Slot Created, status:', postRes.status);

  console.log('3. Streaming binary zip data...');
  const patchRes = await fetch(targetFileUrl, {
    method: 'PATCH',
    headers: {
      'X-Auth': uploadInfo.auth_key,
      'X-Auth-Rest': uploadInfo.rest_auth_key,
      'Tus-Resumable': '1.0.0',
      'Content-Type': 'application/offset+octet-stream',
      'Upload-Offset': '0'
    },
    body: zipData
  });
  console.log('Streamed, status:', patchRes.status, 'Uploaded bytes:', patchRes.headers.get('upload-offset'));

  // Wait 2 seconds for Hostinger filesystem flush
  await new Promise(r => setTimeout(r, 2000));

  console.log('4. Triggering archive deployment...');
  const deployResult = await callHostingerMcp('hosting_deployStaticSiteArchiveV1', {
    username: 'u190341181',
    domain: 'erp.arivahly.in',
    archive_path: 'deploy.zip'
  });
  console.log('Deploy Result:', deployResult);

  console.log('5. Purging cache...');
  try {
    const purge = await callHostingerMcp('hosting_clearWebsiteCacheV1', {
      username: 'u190341181',
      domain: 'erp.arivahly.in'
    });
    console.log('Purge result:', purge);
  } catch (e) {
    console.warn('Purge notice:', e.message);
  }

  console.log('=== DEPLOYMENT COMPLETED ===');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
