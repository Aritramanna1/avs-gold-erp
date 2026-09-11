import crypto from 'crypto';

function base64Url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function testOAuthFlow() {
  const base = 'https://erp.arivahly.in';
  console.log('--- Step 1: Generate PKCE ---');
  const codeVerifier = base64Url(crypto.randomBytes(32));
  const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
  const state = base64Url(crypto.randomBytes(16));
  
  console.log('codeVerifier:', codeVerifier);
  console.log('codeChallenge:', codeChallenge);
  
  console.log('--- Step 2: Request Authorize GET ---');
  const authUrl = `${base}/api/oauth/authorize.php?client_id=chatgpt&redirect_uri=https%3A%2F%2Fchatgpt.com%2Faip%2Foauth%2Fcallback&response_type=code&scope=openid%20profile%20email%20offline_access%20erp%3Aread%20erp%3Awrite%20mcp%3Aexecute&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
  
  let res = await fetch(authUrl);
  console.log('Authorize GET status:', res.status);
  
  console.log('--- Step 3: Submit Approval (POST /api/oauth/authorize.php) ---');
  const postParams = new URLSearchParams({
    client_id: 'chatgpt',
    redirect_uri: 'https://chatgpt.com/aip/oauth/callback',
    scope: 'openid profile email offline_access erp:read erp:write mcp:execute',
    state: state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    tenant_id: 'MTJ_FIRM',
    branch_id: 'MAIN',
    user_id: 'usr_mcp_operator',
    action: 'approve'
  });
  
  res = await fetch(base + '/api/oauth/authorize.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: postParams.toString(),
    redirect: 'manual'
  });
  
  console.log('Authorize POST status:', res.status);
  const location = res.headers.get('location');
  console.log('Location header:', location);
  
  if (!location) {
    console.error('No location header received!');
    return;
  }
  
  const callbackUrl = new URL(location);
  const authCode = callbackUrl.searchParams.get('code');
  const returnState = callbackUrl.searchParams.get('state');
  console.log('Extracted Auth Code:', authCode);
  console.log('State matches:', returnState === state);
  
  console.log('--- Step 4: Token Exchange (POST /api/oauth/token.php) ---');
  const tokenParams = new URLSearchParams({
    grant_type: 'authorization_code',
    code: authCode,
    redirect_uri: 'https://chatgpt.com/aip/oauth/callback',
    client_id: 'chatgpt',
    code_verifier: codeVerifier
  });
  
  res = await fetch(base + '/api/oauth/token.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: tokenParams.toString()
  });
  
  console.log('Token status:', res.status);
  const tokenData = await res.json();
  console.log('Token response keys:', Object.keys(tokenData));
  console.log('Access token present:', !!tokenData.access_token);
  console.log('Refresh token present:', !!tokenData.refresh_token);
  console.log('Scope in response:', tokenData.scope);
  
  console.log('--- Step 5: Refresh Token Exchange ---');
  const refreshParams = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokenData.refresh_token,
    client_id: 'chatgpt'
  });
  
  res = await fetch(base + '/api/oauth/token.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: refreshParams.toString()
  });
  
  console.log('Refresh token status:', res.status);
  const refreshedData = await res.json();
  console.log('New access token present:', !!refreshedData.access_token);
  console.log('New refresh token present:', !!refreshedData.refresh_token);
  
  console.log('--- Step 6: Authenticated MCP request ---');
  res = await fetch(base + '/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenData.access_token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 99,
      method: 'tools/call',
      params: {
        name: 'server/health',
        arguments: {}
      }
    })
  });
  console.log('MCP tool call status:', res.status);
  const callResult = await res.json();
  console.log('MCP tool call result:', JSON.stringify(callResult, null, 2));
}

testOAuthFlow();
