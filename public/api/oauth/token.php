<?php
/**
 * AVS Jewellery ERP — OAuth 2.1 Token Exchange Endpoint
 *
 * Endpoint: /api/oauth/token.php
 * Supports:
 * - grant_type: authorization_code (with PKCE verification)
 * - grant_type: refresh_token (with token rotation)
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(["error" => "invalid_request", "error_description" => "POST method required"]);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$grantType = $input['grant_type'] ?? '';
$clientId = $input['client_id'] ?? '';
$clientSecret = $input['client_secret'] ?? '';

// ── 1. Authorization Code Exchange ──────────────────────────────────────────
if ($grantType === 'authorization_code') {
    $code = $input['code'] ?? '';
    $redirectUri = $input['redirect_uri'] ?? '';
    $codeVerifier = $input['code_verifier'] ?? '';

    if (empty($code)) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_request", "error_description" => "Missing code parameter"]);
        exit;
    }

    $authData = consumeAuthCode($code);
    if (!$authData) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_grant", "error_description" => "Invalid or expired authorization code"]);
        exit;
    }

    // Validate Redirect URI matches authorization request
    if (!empty($authData['redirect_uri']) && !empty($redirectUri) && $authData['redirect_uri'] !== $redirectUri) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_grant", "error_description" => "Redirect URI mismatch"]);
        exit;
    }

    // Verify PKCE Challenge (S256)
    if (!empty($authData['code_challenge'])) {
        if (empty($codeVerifier)) {
            http_response_code(400);
            echo json_encode(["error" => "invalid_request", "error_description" => "Missing code_verifier for PKCE"]);
            exit;
        }
        if (!verifyPkceChallenge($codeVerifier, $authData['code_challenge'], $authData['code_challenge_method'] ?? 'S256')) {
            http_response_code(400);
            echo json_encode(["error" => "invalid_grant", "error_description" => "PKCE verification failed"]);
            exit;
        }
    }

    $jti = bin2hex(random_bytes(16));
    $now = time();
    $userId = $authData['user_id'] ?? 'usr_mcp_operator';
    $tenantId = $authData['tenant_id'] ?? 'MTJ_FIRM';
    $branchId = $authData['branch_id'] ?? 'MAIN';
    $scopes = $authData['scope'] ?? 'erp:read';

    $accessTokenPayload = [
        "iss" => OAUTH_ISSUER,
        "sub" => $userId,
        "aud" => OAUTH_ISSUER,
        "client_id" => $clientId ?: ($authData['client_id'] ?? 'mcp_client'),
        "jti" => $jti,
        "iat" => $now,
        "nbf" => $now,
        "exp" => $now + ACCESS_TOKEN_LIFETIME,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
        "role" => "admin"
    ];

    $accessToken = generateJwt($accessTokenPayload);
    $refreshToken = 'rt_' . bin2hex(random_bytes(32));

    storeRefreshToken($refreshToken, [
        "client_id" => $clientId ?: ($authData['client_id'] ?? 'mcp_client'),
        "user_id" => $userId,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
        "scope" => $scopes,
    ]);

    // Generate OIDC ID Token if openid scope requested
    $idToken = null;
    if (strpos($scopes, 'openid') !== false) {
        $idTokenPayload = [
            "iss" => OAUTH_ISSUER,
            "sub" => $userId,
            "aud" => $clientId ?: 'mcp_client',
            "iat" => $now,
            "exp" => $now + 3600,
            "email" => "operator@avserp.internal",
            "name" => "AVS ERP Authorized Operator",
            "tenant_id" => $tenantId,
            "branch_id" => $branchId
        ];
        $idToken = generateJwt($idTokenPayload);
    }

    $response = [
        "access_token" => $accessToken,
        "token_type" => "Bearer",
        "expires_in" => ACCESS_TOKEN_LIFETIME,
        "refresh_token" => $refreshToken,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
    ];

    if ($idToken) {
        $response["id_token"] = $idToken;
    }

    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── 2. Refresh Token Grant ──────────────────────────────────────────────────
if ($grantType === 'refresh_token') {
    $refreshToken = $input['refresh_token'] ?? '';
    if (empty($refreshToken)) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_request", "error_description" => "Missing refresh_token parameter"]);
        exit;
    }

    $tokenData = consumeRefreshToken($refreshToken); // Rotates old refresh token
    if (!$tokenData) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_grant", "error_description" => "Invalid or expired refresh token"]);
        exit;
    }

    $jti = bin2hex(random_bytes(16));
    $now = time();
    $userId = $tokenData['user_id'];
    $tenantId = $tokenData['tenant_id'];
    $branchId = $tokenData['branch_id'];
    $scopes = $tokenData['scope'];

    $accessTokenPayload = [
        "iss" => OAUTH_ISSUER,
        "sub" => $userId,
        "aud" => OAUTH_ISSUER,
        "client_id" => $tokenData['client_id'],
        "jti" => $jti,
        "iat" => $now,
        "nbf" => $now,
        "exp" => $now + ACCESS_TOKEN_LIFETIME,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
        "role" => "admin"
    ];

    $newAccessToken = generateJwt($accessTokenPayload);
    $newRefreshToken = 'rt_' . bin2hex(random_bytes(32));

    storeRefreshToken($newRefreshToken, $tokenData);

    $response = [
        "access_token" => $newAccessToken,
        "token_type" => "Bearer",
        "expires_in" => ACCESS_TOKEN_LIFETIME,
        "refresh_token" => $newRefreshToken,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
    ];

    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(400);
echo json_encode(["error" => "unsupported_grant_type", "error_description" => "Supported grants: authorization_code, refresh_token"]);
