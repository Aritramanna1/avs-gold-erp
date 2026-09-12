<?php
/**
 * AVS Gold ERP — Hostinger SMTP Live Connection & Authentication Tester
 *
 * Endpoint: POST /api/email/test-connection.php
 *
 * Performs real-time socket connection, TLS handshake, and AUTH LOGIN with Hostinger SMTP server.
 */

require_once __DIR__ . '/../config.php';
require_once __DIR__ . '/secrets.php';
require_once __DIR__ . '/HostingerSmtpClient.php';

handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$payload = json_decode($raw, true) ?: [];

// Load saved credentials as baseline
$creds = loadHostingerCredentials();

// Allow testing new/unsaved credentials directly from form
$host = !empty($payload['host']) ? trim($payload['host']) : $creds['host'];
$port = !empty($payload['port']) ? (int)$payload['port'] : $creds['port'];
$encryption = !empty($payload['encryption']) ? trim($payload['encryption']) : $creds['encryption'];
$username = !empty($payload['username']) ? trim($payload['username']) : $creds['username'];
$password = !empty($payload['password']) ? trim($payload['password']) : $creds['password'];

if (empty($username) || empty($password)) {
    http_response_code(200);
    echo json_encode([
        'success' => false,
        'status' => 'HOSTINGER_EMAIL_NOT_CONFIGURED',
        'error' => 'Hostinger Email not configured. Enter Hostinger mailbox + SMTP password to enable email delivery.',
        'host' => $host,
        'port' => $port,
    ]);
    exit;
}

$client = new HostingerSmtpClient($host, $port, $encryption, $username, $password);
$result = $client->testConnection();

// Update vault test status
saveHostingerCredentials([
    'lastTestedAt' => date('c'),
    'lastTestStatus' => $result['status'],
]);

http_response_code(200);
echo json_encode($result);
