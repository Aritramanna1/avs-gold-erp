import crypto from 'crypto';

function base64Url(buf) {
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

const BASE_URL = 'https://erp.arivahly.in';

async function runTests() {
  console.log('================================================================');
  console.log('    AVS ERP MCP & OAUTH LIVE PRODUCTION COMPATIBILITY AUDIT     ');
  console.log('    Target: ' + BASE_URL);
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // ── TEST 1: Discovery & Well-Known ──────────────────────────────────────────
  console.log('[1/10] Testing RFC 8414 & OpenID Discovery Endpoints...');
  {
    const res = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
    assert(res.status === 200, 'oauth-authorization-server status 200');
    assert(res.headers.get('content-type')?.includes('application/json'), 'oauth-authorization-server content-type is application/json');
    const data = await res.json();
    assert(data.issuer === BASE_URL, 'issuer matches BASE_URL');
    assert(data.grant_types_supported.includes('authorization_code'), 'grant_types includes authorization_code');
    assert(data.grant_types_supported.includes('refresh_token'), 'grant_types includes refresh_token');
    assert(data.code_challenge_methods_supported.includes('S256'), 'code_challenge_methods includes S256');
    assert(data.scopes_supported.includes('offline_access'), 'scopes includes offline_access');
  }

  // ── TEST 2: MCP initialize handshake ────────────────────────────────────────
  console.log('\n[2/10] Testing MCP initialize handshake...');
  {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'ChatGPT', version: '1.0.0' }
        }
      })
    });
    assert(res.status === 200, 'initialize returned HTTP 200');
    assert(res.headers.get('content-type')?.includes('application/json'), 'Content-Type is application/json');
    assert(res.headers.get('access-control-allow-origin') === '*', 'CORS Access-Control-Allow-Origin is *');
    const body = await res.json();
    assert(body.jsonrpc === '2.0', 'jsonrpc is 2.0');
    assert(body.id === 1, 'response id matches request id');
    assert(body.result.serverInfo.name === 'avs-erp-mcp-server', 'serverInfo name is avs-erp-mcp-server');
    assert(body.result.capabilities.tools !== undefined, 'tools capabilities advertised');
    assert(body.result.capabilities.resources !== undefined, 'resources capabilities advertised');
    assert(body.result.capabilities.prompts !== undefined, 'prompts capabilities advertised');
  }

  // ── TEST 3: JSON-RPC Notifications Handling ─────────────────────────────────
  console.log('\n[3/10] Testing notifications/initialized & notifications/cancelled...');
  {
    let res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {}
      })
    });
    assert(res.status === 200 || res.status === 204, 'notifications/initialized returned 200/204 (no error)');

    res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'notifications/cancelled',
        params: { requestId: '123' }
      })
    });
    assert(res.status === 200 || res.status === 204, 'notifications/cancelled returned 200/204 (no error)');
  }

  // ── TEST 4: MCP Ping ────────────────────────────────────────────────────────
  console.log('\n[4/10] Testing ping...');
  {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 42,
        method: 'ping',
        params: {}
      })
    });
    assert(res.status === 200, 'ping returned HTTP 200');
    const body = await res.json();
    assert(body.id === 42, 'ping response id is 42');
    assert(body.result !== undefined, 'ping result is defined');
  }

  // ── TEST 5: MCP resources & prompts ─────────────────────────────────────────
  console.log('\n[5/10] Testing resources/list & prompts/list...');
  {
    let res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 50,
        method: 'resources/list',
        params: {}
      })
    });
    assert(res.status === 200, 'resources/list returned HTTP 200');
    let body = await res.json();
    assert(Array.isArray(body.result?.resources), 'resources is an array');

    res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 51,
        method: 'prompts/list',
        params: {}
      })
    });
    assert(res.status === 200, 'prompts/list returned HTTP 200');
    body = await res.json();
    assert(Array.isArray(body.result?.prompts), 'prompts is an array');
  }

  // ── TEST 6: Tool Discovery & OpenAI Naming Schema Validation ────────────────
  console.log('\n[6/10] Testing tools/list catalog & OpenAI regex conformance...');
  {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 100,
        method: 'tools/list',
        params: {}
      })
    });
    assert(res.status === 200, 'tools/list returned HTTP 200');
    const body = await res.json();
    const tools = body.result?.tools;
    assert(Array.isArray(tools), 'tools is an array');
    assert(tools.length >= 59, `tools count is at least 59 (found ${tools.length})`);

    const openaiRegex = /^[a-zA-Z0-9_-]{1,64}$/;
    let nameErrors = 0;
    let schemaErrors = 0;

    for (const t of tools) {
      if (!openaiRegex.test(t.name)) {
        console.error(`    Tool name invalid for OpenAI: ${t.name}`);
        nameErrors++;
      }
      if (!t.inputSchema || t.inputSchema.type !== 'object') {
        console.error(`    Tool schema invalid: ${t.name}`);
        schemaErrors++;
      }
      if (!t.inputSchema.properties || typeof t.inputSchema.properties !== 'object' || Array.isArray(t.inputSchema.properties)) {
        console.error(`    Tool properties invalid (must be object, not array): ${t.name}`);
        schemaErrors++;
      }
      if (t.inputSchema.required && !Array.isArray(t.inputSchema.required)) {
        console.error(`    Tool required invalid: ${t.name}`);
        schemaErrors++;
      }
    }

    assert(nameErrors === 0, `All 59 tool names conform to OpenAI pattern ^[a-zA-Z0-9_-]{1,64}$ (${nameErrors} errors)`);
    assert(schemaErrors === 0, `All 59 tool inputSchemas are valid JSON Schema objects (${schemaErrors} errors)`);
  }

  // ── TEST 7: Diagnostic Tool Slicing & Pagination ────────────────────────────
  console.log('\n[7/10] Testing Diagnostic Tool Slicing (1, 5, 10, 25, 50, all)...');
  for (const limit of [1, 5, 10, 25, 50]) {
    const res = await fetch(`${BASE_URL}/api/mcp?limit=${limit}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 200 + limit,
        method: 'tools/list',
        params: {}
      })
    });
    assert(res.status === 200, `Diagnostic limit=${limit} returned HTTP 200`);
    const body = await res.json();
    assert(body.result?.tools?.length === limit, `Returned exactly ${limit} tools`);
  }

  // ── TEST 8: Single Tool Filter ──────────────────────────────────────────────
  console.log('\n[8/10] Testing single tool query (?tool=server_health)...');
  {
    const res = await fetch(`${BASE_URL}/api/mcp?tool=server_health`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 300,
        method: 'tools/list',
        params: {}
      })
    });
    assert(res.status === 200, 'tool query returned HTTP 200');
    const body = await res.json();
    assert(body.result?.tools?.length === 1, 'Single tool returned');
    assert(body.result?.tools[0]?.name === 'server_health', 'Tool name matches server_health');
  }

  // ── TEST 9: Unauthenticated & Flexible Tool Execution ───────────────────────
  console.log('\n[9/10] Testing tool execution with underscore & slash aliases...');
  {
    // Test server_health
    let res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 401,
        method: 'tools/call',
        params: { name: 'server_health', arguments: {} }
      })
    });
    assert(res.status === 200, 'server_health call returned HTTP 200');
    let body = await res.json();
    assert(body.result?.structuredData?.status === 'HEALTHY', 'server_health status is HEALTHY');

    // Test server/health (backward compatibility alias)
    res = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 402,
        method: 'tools/call',
        params: { name: 'server/health', arguments: {} }
      })
    });
    assert(res.status === 200, 'server/health backward compatible alias returned HTTP 200');
    body = await res.json();
    assert(body.result?.structuredData?.status === 'HEALTHY', 'server/health status is HEALTHY');
  }

  // ── TEST 10: Complete OAuth 2.1 PKCE Flow & Authenticated Calls ─────────────
  console.log('\n[10/10] Testing Complete OAuth 2.1 PKCE S256 + Token Rotation Flow...');
  {
    const codeVerifier = base64Url(crypto.randomBytes(32));
    const codeChallenge = base64Url(crypto.createHash('sha256').update(codeVerifier).digest());
    const state = base64Url(crypto.randomBytes(16));

    // Consent POST
    const postParams = new URLSearchParams({
      client_id: 'chatgpt_custom_mcp_app',
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

    const authRes = await fetch(`${BASE_URL}/api/oauth/authorize.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: postParams.toString(),
      redirect: 'manual'
    });

    assert(authRes.status === 302, 'Authorize approved with HTTP 302 redirect');
    const location = authRes.headers.get('location');
    assert(!!location, 'Location header present');
    const callbackUrl = new URL(location);
    const authCode = callbackUrl.searchParams.get('code');
    const returnState = callbackUrl.searchParams.get('state');
    assert(!!authCode, 'Auth code generated');
    assert(returnState === state, 'State preserved exactly');

    // Token Exchange
    const tokenRes = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: 'https://chatgpt.com/aip/oauth/callback',
        client_id: 'chatgpt_custom_mcp_app',
        code_verifier: codeVerifier
      }).toString()
    });

    assert(tokenRes.status === 200, 'Token exchange returned HTTP 200');
    const tokenData = await tokenRes.json();
    assert(!!tokenData.access_token, 'access_token present in response');
    assert(!!tokenData.refresh_token, 'refresh_token present in response');
    assert(tokenData.token_type === 'Bearer', 'token_type is Bearer');
    assert(tokenData.scope.includes('offline_access'), 'scope includes offline_access');

    // Refresh Token Exchange
    const refreshRes = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
        client_id: 'chatgpt_custom_mcp_app'
      }).toString()
    });

    assert(refreshRes.status === 200, 'Refresh token exchange returned HTTP 200');
    const refreshData = await refreshRes.json();
    assert(!!refreshData.access_token, 'New access_token generated');
    assert(!!refreshData.refresh_token, 'New rotated refresh_token generated');

    // Authenticated Tool Call: core_get_system_status
    const toolRes = await fetch(`${BASE_URL}/api/mcp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${refreshData.access_token}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 999,
        method: 'tools/call',
        params: {
          name: 'core_get_system_status',
          arguments: {}
        }
      })
    });

    assert(toolRes.status === 200, 'Authenticated tool call core_get_system_status returned HTTP 200');
    const toolData = await toolRes.json();
    assert(toolData.result?.structuredData?.status === 'OPERATIONAL', 'System status is OPERATIONAL');
    assert(toolData.result?.structuredData?.finenessStandard === 995, 'Fineness standard is 995 basis');
    assert(toolData.result?.structuredData?.accountingMode === 'DUAL_DIMENSION_DISCRETE', 'Dual dimension discrete accounting mode verified');
  }

  console.log('\n================================================================');
  console.log(` AUDIT SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
