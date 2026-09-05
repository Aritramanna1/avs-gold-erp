import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

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
          } catch {
            // Not a full JSON yet
          }
        }
      }
    });

    proc.stderr.on('data', () => {});

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
    }, 90000);
  });
}

async function main() {
  console.log('=== HOSTINGER AUTOMATED DEPLOYMENT FOR ERP.ARIVAHLY.IN ===');
  
  console.log('1. Generating secure file upload URL...');
  const uploadInfo = await callHostingerMcp('hosting_generateUploadURLV1', {
    username: 'u190341181',
    domain: 'erp.arivahly.in'
  });
  console.log('Upload Endpoint:', uploadInfo.url);

  const zipPath = path.resolve('erp-arivahly-production-deploy.zip');
  const zipData = fs.readFileSync(zipPath);
  console.log(`Package size: ${(zipData.length / 1024 / 1024).toFixed(2)} MB (${zipData.length} bytes)`);

  const fileTargetUrl = `${uploadInfo.url}/deploy.zip?override=true`;

  console.log('2. Creating TUS upload slot on Hostinger...');
  const postRes = await fetch(fileTargetUrl, {
    method: 'POST',
    headers: {
      'X-Auth': uploadInfo.auth_key,
      'X-Auth-Rest': uploadInfo.rest_auth_key,
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(zipData.length),
      'Upload-Offset': '0'
    }
  });
  console.log('TUS Slot Created, Status:', postRes.status);

  console.log('3. Streaming binary zip to Hostinger...');
  const patchRes = await fetch(fileTargetUrl, {
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
  console.log('Binary Upload Finished, Status:', patchRes.status, 'Uploaded bytes:', patchRes.headers.get('upload-offset'));

  console.log('4. Extracting deployment archive on Hostinger server...');
  const deployResult = await callHostingerMcp('hosting_deployStaticSiteArchiveV1', {
    username: 'u190341181',
    domain: 'erp.arivahly.in',
    archive_path: 'public_html/deploy.zip'
  });
  console.log('Deploy Extraction Result:', JSON.stringify(deployResult, null, 2));

  console.log('5. Deployment successfully completed!');
}

main().catch(err => {
  console.error('Deployment failure:', err);
  process.exit(1);
});
