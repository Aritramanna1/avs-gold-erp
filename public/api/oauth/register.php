<?php
/**
 * AVS Jewellery ERP — RFC 7591 Dynamic Client Registration (DCR) Endpoint
 *
 * Endpoint: /api/oauth/register.php
 * Allows MCP clients (ChatGPT, Claude, IDEs, external integrations) to dynamically
 * register OAuth 2.1 public clients with PKCE without hardcoded or manual credentials.
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, Accept");
header("Cache-Control: no-store, no-cache, must-revalidate");
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        "error" => "invalid_request",
        "error_description" => "Dynamic Client Registration requires POST method."
    ]);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode([
        "error" => "invalid_request",
        "error_description" => "Request payload must be valid JSON."
    ]);
    exit;
}

$clientName = trim($data['client_name'] ?? 'Dynamic MCP Client');
$redirectUris = $data['redirect_uris'] ?? [];

if (empty($redirectUris) || !is_array($redirectUris)) {
    http_response_code(400);
    echo json_encode([
        "error" => "invalid_redirect_uri",
        "error_description" => "redirect_uris array is required."
    ]);
    exit;
}

// Validate each redirect URI: must be HTTPS or localhost for development
foreach ($redirectUris as $uri) {
    if (!filter_var($uri, FILTER_VALIDATE_URL)) {
        http_response_code(400);
        echo json_encode([
            "error" => "invalid_redirect_uri",
            "error_description" => "Invalid URI format: " . htmlspecialchars($uri)
        ]);
        exit;
    }
    
    $parsed = parse_url($uri);
    $scheme = strtolower($parsed['scheme'] ?? '');
    $host = strtolower($parsed['host'] ?? '');
    
    $isLocal = ($host === 'localhost' || $host === '127.0.0.1');
    if ($scheme !== 'https' && !$isLocal) {
        http_response_code(400);
        echo json_encode([
            "error" => "invalid_redirect_uri",
            "error_description" => "redirect_uri must use HTTPS scheme (except localhost)."
        ]);
        exit;
    }
}

// Register dynamic client
$registration = registerDynamicClient([
    'client_name' => $clientName,
    'redirect_uris' => array_values(array_unique($redirectUris)),
    'grant_types' => $data['grant_types'] ?? ['authorization_code', 'refresh_token'],
    'response_types' => $data['response_types'] ?? ['code'],
    'token_endpoint_auth_method' => $data['token_endpoint_auth_method'] ?? 'none',
    'scope' => $data['scope'] ?? 'openid profile email erp:read erp:write mcp:execute offline_access',
    'client_uri' => $data['client_uri'] ?? null,
    'logo_uri' => $data['logo_uri'] ?? null,
    'contacts' => $data['contacts'] ?? []
]);

http_response_code(201);
echo json_encode($registration, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
