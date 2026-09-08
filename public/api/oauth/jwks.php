<?php
/**
 * AVS Jewellery ERP — JWKS (JSON Web Key Set) Endpoint
 *
 * Endpoint: /api/oauth/jwks.php
 */

require_once __DIR__ . '/oauth-service.php';

header("Content-Type: application/json; charset=utf-8");
header("Access-Control-Allow-Origin: *");
header("Cache-Control: public, max-age=86400");

$jwks = [
    "keys" => [
        [
            "kty" => "oct",
            "use" => "sig",
            "alg" => "HS256",
            "kid" => "avs-erp-key-2026-01"
        ]
    ]
];

echo json_encode($jwks, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
