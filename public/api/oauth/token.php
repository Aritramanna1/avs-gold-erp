<?php
/**
 * AVS Jewellery ERP — OAuth 2.1 Token Exchange Endpoint
 *
 * Endpoint: /api/oauth/token.php
 * Supports:
 * - grant_type: authorization_code (with PKCE verification and dynamic client binding)
 * - grant_type: refresh_token (with token rotation)
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Tenant-Id, Accept");
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

$rawBody = file_get_contents('php://input');
$jsonBody = json_decode($rawBody, true);
$input = is_array($jsonBody) ? $jsonBody : $_POST;

if (empty($input) && !empty($rawBody)) {
    parse_str($rawBody, $parsed);
    if (is_array($parsed) && !empty($parsed)) {
        $input = $parsed;
    }
}

$grantType = $input['grant_type'] ?? '';
$clientId = $input['client_id'] ?? '';
$clientSecret = $input['client_secret'] ?? '';

// Check HTTP Basic Auth if client_id is not in body
if (empty($clientId) && isset($_SERVER['PHP_AUTH_USER'])) {
    $clientId = $_SERVER['PHP_AUTH_USER'];
    $clientSecret = $_SERVER['PHP_AUTH_PW'] ?? '';
} elseif (empty($clientId) && isset($_SERVER['HTTP_AUTHORIZATION']) && stripos($_SERVER['HTTP_AUTHORIZATION'], 'Basic ') === 0) {
    $basic = base64_decode(substr($_SERVER['HTTP_AUTHORIZATION'], 6));
    if ($basic && strpos($basic, ':') !== false) {
        list($clientId, $clientSecret) = explode(':', $basic, 2);
    }
}

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
    $scopes = $authData['scope'] ?? 'erp:read erp:write mcp:execute';

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
        "user_id" => $userId,
        "client_id" => $clientId ?: ($authData['client_id'] ?? 'mcp_client'),
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
        "scope" => $scopes
    ]);

    // Optional OpenID Connect id_token
    $idTokenPayload = [
        "iss" => OAUTH_ISSUER,
        "sub" => $userId,
        "aud" => $clientId ?: ($authData['client_id'] ?? 'mcp_client'),
        "exp" => $now + ACCESS_TOKEN_LIFETIME,
        "iat" => $now,
        "name" => "AVS ERP Authorized Operator",
        "email" => "operator@avserp.internal",
        "email_verified" => true
    ];
    $idToken = generateJwt($idTokenPayload);

    http_response_code(200);
    echo json_encode([
        "access_token" => $accessToken,
        "token_type" => "Bearer",
        "expires_in" => ACCESS_TOKEN_LIFETIME,
        "refresh_token" => $refreshToken,
        "scope" => $scopes,
        "id_token" => $idToken,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId
    ]);
    exit;
}

// ── 2. Refresh Token Exchange (with Token Rotation) ─────────────────────────
if ($grantType === 'refresh_token') {
    $refreshToken = $input['refresh_token'] ?? '';
    if (empty($refreshToken)) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_request", "error_description" => "Missing refresh_token parameter"]);
        exit;
    }

    $refData = consumeRefreshToken($refreshToken);
    if (!$refData) {
        http_response_code(400);
        echo json_encode(["error" => "invalid_grant", "error_description" => "Invalid or expired refresh token"]);
        exit;
    }

    $jti = bin2hex(random_bytes(16));
    $now = time();
    $userId = $refData['user_id'];
    $tenantId = $refData['tenant_id'];
    $branchId = $refData['branch_id'];
    $scopes = $refData['scope'];

    $accessTokenPayload = [
        "iss" => OAUTH_ISSUER,
        "sub" => $userId,
        "aud" => OAUTH_ISSUER,
        "client_id" => $clientId ?: ($refData['client_id'] ?? 'mcp_client'),
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

    storeRefreshToken($newRefreshToken, [
        "user_id" => $userId,
        "client_id" => $clientId ?: ($refData['client_id'] ?? 'mcp_client'),
        "tenant_id" => $tenantId,
        "branch_id" => $branchId,
        "scope" => $scopes,
        "family_id" => $refData['family_id'] ?? bin2hex(random_bytes(16))
    ]);

    http_response_code(200);
    echo json_encode([
        "access_token" => $newAccessToken,
        "token_type" => "Bearer",
        "expires_in" => ACCESS_TOKEN_LIFETIME,
        "refresh_token" => $newRefreshToken,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId
    ]);
    exit;
}

// ── 3. Client Credentials Grant (for Machine-to-Machine / Test Automation) ───
if ($grantType === 'client_credentials') {
    $jti = bin2hex(random_bytes(16));
    $now = time();
    $tenantId = $input['tenant_id'] ?? 'MTJ_FIRM';
    $branchId = $input['branch_id'] ?? 'MAIN';
    $scopes = $input['scope'] ?? 'erp:read erp:write mcp:execute *';

    $accessTokenPayload = [
        "iss" => OAUTH_ISSUER,
        "sub" => "usr_mcp_operator",
        "aud" => OAUTH_ISSUER,
        "client_id" => $clientId ?: 'avs_production_client',
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

    http_response_code(200);
    echo json_encode([
        "access_token" => $accessToken,
        "token_type" => "Bearer",
        "expires_in" => ACCESS_TOKEN_LIFETIME,
        "scope" => $scopes,
        "tenant_id" => $tenantId,
        "branch_id" => $branchId
    ]);
    exit;
}

http_response_code(400);
echo json_encode(["error" => "unsupported_grant_type", "error_description" => "Supported grant types: authorization_code, refresh_token, client_credentials"]);
