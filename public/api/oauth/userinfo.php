<?php
/**
 * AVS Jewellery ERP — OpenID Connect UserInfo Endpoint
 *
 * Endpoint: /api/oauth/userinfo.php
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$context = resolveMcpAuthContext();
if (!$context) {
    http_response_code(401);
    echo json_encode(["error" => "invalid_token", "error_description" => "Invalid or expired access token"]);
    exit;
}

$userInfo = [
    "sub" => $context['userId'],
    "name" => "AVS ERP Operator (" . $context['userId'] . ")",
    "email" => "operator@avserp.internal",
    "email_verified" => true,
    "role" => $context['role'],
    "tenant_id" => $context['tenantId'],
    "branch_id" => $context['branchId'],
    "scopes" => $context['scopes']
];

echo json_encode($userInfo, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
