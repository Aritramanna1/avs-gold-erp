<?php
/**
 * AVS Gold ERP — Hostinger Email Provider Configuration Endpoint
 *
 * GET /api/email/provider-config.php  -> Returns safe public status (no plaintext password)
 * POST /api/email/provider-config.php -> Saves credentials to encrypted server-side vault
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/secrets.php';
require_once __DIR__ . '/HostingerSmtpClient.php';

handleCors();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = getPublicHostingerStatus();
    http_response_code(200);
    echo json_encode($status);
    exit;
}

if ($method === 'POST') {
    $raw = file_get_contents('php://input');
    $payload = json_decode($raw, true);

    if (!$payload || !is_array($payload)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON payload']);
        exit;
    }

    $saved = saveHostingerCredentials($payload);

    // If auto-test requested
    $testResult = null;
    if (!empty($payload['autoTest'])) {
        $creds = loadHostingerCredentials();
        $client = new HostingerSmtpClient(
            $creds['host'],
            $creds['port'],
            $creds['encryption'],
            $creds['username'],
            $creds['password']
        );
        $testResult = $client->testConnection();
        $saved = saveHostingerCredentials([
            'lastTestedAt' => date('c'),
            'lastTestStatus' => $testResult['status'],
        ]);
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Hostinger Email provider credentials saved securely.',
        'config' => $saved,
        'testResult' => $testResult,
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method Not Allowed']);
