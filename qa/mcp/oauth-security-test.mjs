#!/usr/bin/env node
/**
 * AVS ERP — OAUTH 2.1 & EXPANDED MCP DEEP SECURITY TEST SUITE
 *
 * Validates:
 * 1. RFC 8414 Discovery Metadata & OpenID Configuration
 * 2. PKCE (S256) Authorization Code Flow
 * 3. Token Rotation, Revocation, and Single-Use Enforcement
 * 4. Negative Attacks: PKCE bypass, Code Replay, Cross-Tenant Spillage, Revoked Token Use
 * 5. Full-Spectrum ERP MCP Tools with OAuth Token
 */

import crypto from "crypto";
import assert from "assert/strict";

const BASE_URL = (process.env.BASE_URL || "https://erp.arivahly.in").replace(/\/+$/, "");

function base64Url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generatePkce() {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function runOAuthSecurityTests() {
  console.log("================================================================================");
  console.log("AVS ERP — OAUTH 2.1 & EXPANDED MCP DEEP SECURITY TEST SUITE");
  console.log("Target Base URL:", BASE_URL);
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  async function testStep(title, fn) {
    process.stdout.write(`▶ ${title.padEnd(65)} ... `);
    try {
      const detail = await fn();
      console.log(`✅ PASS ${detail ? `(${detail})` : ""}`);
      passed++;
    } catch (err) {
      console.log(`❌ FAIL: ${err.message}`);
      failed++;
    }
  }

  // 1. Discovery Metadata
  await testStep("1. RFC 8414 OAuth 2.0 Authorization Server Discovery", async () => {
    const res = await fetch(`${BASE_URL}/.well-known/oauth-authorization-server`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const meta = await res.json();
    assert.ok(meta.authorization_endpoint, "Missing authorization_endpoint");
    assert.ok(meta.token_endpoint, "Missing token_endpoint");
    assert.ok(meta.jwks_uri, "Missing jwks_uri");
    assert.ok(meta.code_challenge_methods_supported.includes("S256"), "S256 required");
    return `${meta.scopes_supported.length} scopes advertised`;
  });

  await testStep("2. OpenID Connect Discovery Metadata", async () => {
    const res = await fetch(`${BASE_URL}/.well-known/openid-configuration`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const meta = await res.json();
    assert.ok(meta.issuer, "Missing issuer");
    assert.ok(meta.userinfo_endpoint, "Missing userinfo_endpoint");
    return `Issuer: ${meta.issuer}`;
  });

  await testStep("3. JWKS Key Set Endpoint", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/jwks.php`);
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const jwks = await res.json();
    assert.ok(Array.isArray(jwks.keys) && jwks.keys.length > 0, "Expected non-empty keys array");
    return `Key ID: ${jwks.keys[0].kid}`;
  });

  // 4. Authorization Code Flow with PKCE S256
  const { verifier, challenge } = generatePkce();
  let authCode = "";
  const redirectUri = "https://oauth.pstmn.io/v1/callback";

  await testStep("4. Consent & Authorization Code Generation (PKCE S256)", async () => {
    const authUrl = `${BASE_URL}/api/oauth/authorize.php`;
    const params = new URLSearchParams({
      action: "allow",
      client_id: "chatgpt_mcp_client",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid profile erp:read erp:write finance:read stock:read karigar:write",
      state: "xyzState123",
      code_challenge: challenge,
      code_challenge_method: "S256",
      tenant_id: "MTJ_FIRM",
      branch_id: "MAIN",
    });

    const res = await fetch(`${authUrl}?${params.toString()}`, { redirect: "manual" });
    assert.equal(res.status, 302, `Expected 302 redirect, got ${res.status}`);
    const location = res.headers.get("location");
    assert.ok(location, "Missing Location header in redirect");
    const locUrl = new URL(location);
    authCode = locUrl.searchParams.get("code");
    assert.ok(authCode && authCode.startsWith("ac_"), `Invalid code: ${authCode}`);
    assert.equal(locUrl.searchParams.get("state"), "xyzState123");
    return `Code: ${authCode.slice(0, 10)}...`;
  });

  // 5. Negative Test: Token Exchange with Wrong PKCE Verifier
  await testStep("5. Security: Rejection of Invalid PKCE Code Verifier", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: authCode,
        redirect_uri: redirectUri,
        code_verifier: "wrong_invalid_verifier_tampered",
        client_id: "chatgpt_mcp_client",
      }),
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.error, "invalid_grant");
    return "400 invalid_grant PKCE failure enforced";
  });

  // Need a new auth code since the failed attempt or valid attempt needs clean state
  const pkceValid = generatePkce();
  let validCode = "";
  const resGen = await fetch(
    `${BASE_URL}/api/oauth/authorize.php?` +
      new URLSearchParams({
        action: "allow",
        client_id: "chatgpt_mcp_client",
        redirect_uri: redirectUri,
        response_type: "code",
        scope: "openid profile erp:read erp:write finance:read stock:read karigar:write",
        state: "state999",
        code_challenge: pkceValid.challenge,
        code_challenge_method: "S256",
      }),
    { redirect: "manual" }
  );
  validCode = new URL(resGen.headers.get("location")).searchParams.get("code");

  let accessToken = "";
  let refreshToken = "";

  await testStep("6. Valid Token Exchange (PKCE S256 -> JWT Access & Refresh Token)", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: validCode,
        redirect_uri: redirectUri,
        code_verifier: pkceValid.verifier,
        client_id: "chatgpt_mcp_client",
      }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const tokenData = await res.json();
    assert.ok(tokenData.access_token, "Missing access_token");
    assert.ok(tokenData.refresh_token, "Missing refresh_token");
    assert.ok(tokenData.id_token, "Missing OIDC id_token");
    assert.equal(tokenData.token_type, "Bearer");
    assert.equal(tokenData.tenant_id, "MTJ_FIRM");
    assert.equal(tokenData.branch_id, "MAIN");
    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    return `Access Token Expiry: ${tokenData.expires_in}s`;
  });

  // 7. Negative Test: Code Replay Attack
  await testStep("7. Security: Rejection of Authorization Code Replay Attack", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code: validCode,
        redirect_uri: redirectUri,
        code_verifier: pkceValid.verifier,
        client_id: "chatgpt_mcp_client",
      }),
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    const body = await res.json();
    assert.equal(body.error, "invalid_grant");
    return "Single-use code rule strictly enforced";
  });

  // 8. Refresh Token Rotation
  let rotatedAccessToken = "";
  let rotatedRefreshToken = "";
  await testStep("8. Refresh Token Rotation (Exchange RT for new AT & RT)", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "chatgpt_mcp_client",
      }),
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const data = await res.json();
    assert.ok(data.access_token);
    assert.ok(data.refresh_token);
    assert.notEqual(data.refresh_token, refreshToken, "Refresh token must rotate");
    rotatedAccessToken = data.access_token;
    rotatedRefreshToken = data.refresh_token;
    return "Rotated successfully";
  });

  // 9. Negative Test: Old Refresh Token Replay
  await testStep("9. Security: Rejection of Old Rotated Refresh Token", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/token.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken, // Old token
        client_id: "chatgpt_mcp_client",
      }),
    });
    assert.equal(res.status, 400, `Expected 400, got ${res.status}`);
    return "400 invalid_grant on old refresh token";
  });

  // 10. OIDC UserInfo with OAuth Bearer Token
  await testStep("10. OIDC UserInfo Endpoint Verification", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/userinfo.php`, {
      headers: { Authorization: `Bearer ${rotatedAccessToken}` },
    });
    assert.equal(res.status, 200, `Expected 200, got ${res.status}`);
    const user = await res.json();
    assert.equal(user.tenant_id, "MTJ_FIRM");
    assert.equal(user.branch_id, "MAIN");
    return `User: ${user.sub}, Role: ${user.role}`;
  });

  // 11. MCP Tool Execution with OAuth Bearer Token
  await testStep("11. MCP Protocol Handshake with OAuth Bearer Auth", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_01",
        method: "initialize",
        params: { protocolVersion: "2024-11-05" },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.result.serverInfo.name, "avs-erp-mcp-server");
    assert.equal(body.result.finenessBasis, 995);
    return `Fineness Standard: ${body.result.finenessBasis}`;
  });

  // 12. Expanded MCP Tools Discovery
  await testStep("12. Expanded MCP Tools Discovery (tools/list)", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_02",
        method: "tools/list",
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const tools = body.result.tools;
    assert.ok(tools.length >= 15, `Expected >= 15 tools, got ${tools.length}`);
    return `Discovered ${tools.length} Full-Spectrum ERP Tools`;
  });

  // 13. Discrete Dual-Dimension Ledger via OAuth Token
  await testStep("13. Discrete Cash & 995 Gold Ledger Execution", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_03",
        method: "tools/call",
        params: {
          name: "finance.get_account_balance",
          arguments: { partyId: "CUST_SANJAY_MEHTA" },
        },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.result.structuredData;
    assert.equal(data.accountingStandard, "DUAL_DIMENSION_DISCRETE");
    assert.ok(data.cash.balanceRupees);
    assert.ok(data.gold.fineGoldGrams);
    assert.equal(data.gold.basisStandard, 995);
    return `Cash: ${data.cash.balanceRupees} | Gold: ${data.gold.fineGoldGrams}`;
  });

  // 14. Daily Bhav & 995 Fineness Basis Conversion
  await testStep("14. Gold Rate Card (Daily Bhav) & 995 Fineness Conversion", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_04",
        method: "tools/call",
        params: {
          name: "gold.convert_fineness_basis",
          arguments: { grossWeightGrams: 24.5, purity: "22K" },
        },
      }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const data = body.result.structuredData;
    assert.equal(data.basisFineness, 995);
    assert.equal(data.pureGoldGrams, 22.442);
    return `24.5g 22K -> ${data.fineGoldEquivalent995Grams}g @ 995 basis`;
  });

  // 15. Negative Test: Cross-Tenant Spillage Rejection
  await testStep("15. Security: Cross-Tenant Isolation Negative Rejection", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_05",
        method: "tools/call",
        params: {
          name: "finance.get_account_balance",
          arguments: { partyId: "CUST_SANJAY_MEHTA", targetTenantId: "ROGUE_TENANT_XYZ" },
        },
      }),
    });
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    const body = await res.json();
    assert.ok(body.error.message.includes("TENANT_ACCESS_DENIED"));
    return "403 TENANT_ACCESS_DENIED enforced";
  });

  // 16. Token Revocation via RFC 7009
  await testStep("16. RFC 7009 Token Revocation", async () => {
    const res = await fetch(`${BASE_URL}/api/oauth/revoke.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rotatedAccessToken }),
    });
    assert.equal(res.status, 200);
    return "Token revoked successfully";
  });

  // 17. Security: Revoked Token Rejection
  await testStep("17. Security: Immediate Rejection of Revoked Access Token", async () => {
    const res = await fetch(`${BASE_URL}/api/mcp/index.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rotatedAccessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "mcp_06",
        method: "tools/call",
        params: {
          name: "customers.search_customers",
          arguments: { query: "Mehta" },
        },
      }),
    });
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    return "401 AUTHENTICATION_REQUIRED on revoked token";
  });

  console.log("\n================================================================================");
  console.log(`OAUTH 2.1 & MCP SECURITY TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runOAuthSecurityTests().catch((e) => {
  console.error("Test execution failed:", e);
  process.exit(1);
});
