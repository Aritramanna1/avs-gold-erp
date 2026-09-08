<?php
/**
 * AVS Jewellery ERP — RFC 8414 OAuth 2.0 Authorization Server Metadata & OpenID Configuration
 *
 * Endpoint: /.well-known/oauth-authorization-server & /.well-known/openid-configuration
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Cache-Control: public, max-age=3600");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$metadata = [
    "issuer" => OAUTH_ISSUER,
    "authorization_endpoint" => OAUTH_ISSUER . "/api/oauth/authorize.php",
    "token_endpoint" => OAUTH_ISSUER . "/api/oauth/token.php",
    "jwks_uri" => OAUTH_ISSUER . "/api/oauth/jwks.php",
    "revocation_endpoint" => OAUTH_ISSUER . "/api/oauth/revoke.php",
    "userinfo_endpoint" => OAUTH_ISSUER . "/api/oauth/userinfo.php",
    "mcp_endpoint" => OAUTH_ISSUER . "/api/mcp",
    
    "response_types_supported" => ["code"],
    "response_modes_supported" => ["query"],
    "grant_types_supported" => [
        "authorization_code",
        "refresh_token"
    ],
    "code_challenge_methods_supported" => ["S256", "plain"],
    
    "scopes_supported" => ALL_SUPPORTED_SCOPES,
    
    "token_endpoint_auth_methods_supported" => [
        "none", // Public clients / PKCE (ChatGPT, Claude, Mobile)
        "client_secret_post",
        "client_secret_basic"
    ],
    
    "token_endpoint_auth_signing_alg_values_supported" => ["HS256"],
    "id_token_signing_alg_values_supported" => ["HS256"],
    "subject_types_supported" => ["public"],
    
    "service_documentation" => OAUTH_ISSUER . "/docs/mcp/README.md",
    "op_policy_uri" => OAUTH_ISSUER . "/privacy",
    "op_tos_uri" => OAUTH_ISSUER . "/terms"
];

echo json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
