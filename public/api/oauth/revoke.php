<?php
/**
 * AVS Jewellery ERP — RFC 7009 Token Revocation Endpoint
 *
 * Endpoint: /api/oauth/revoke.php
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
$token = $input['token'] ?? '';

if (!empty($token)) {
    revokeToken($token);
}

// RFC 7009 specifies 200 OK on successful revocation (even if token was already invalid)
http_response_code(200);
echo json_encode(["status" => "revoked"]);
