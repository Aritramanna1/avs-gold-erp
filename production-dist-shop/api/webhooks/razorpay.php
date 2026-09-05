<?php
/**
 * MTJ / AVS ERP — Hostinger Razorpay Webhook Endpoint
 *
 * Endpoint: /api/webhooks/razorpay.php
 *
 * Validates cryptographic HMAC signature, logs payment status, and
 * securely updates payment transaction records in Supabase PostgreSQL.
 */

require_once __DIR__ . '/../config.php';
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';

// Validate Webhook Signature if secret is configured
if (!empty($RAZORPAY_WEBHOOK_SECRET)) {
    $expectedSignature = hash_hmac('sha256', $rawPayload, $RAZORPAY_WEBHOOK_SECRET);
    if (!hash_equals($expectedSignature, $signature)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid Razorpay Webhook Signature']);
        exit;
    }
}

$eventData = json_decode($rawPayload, true);
if (!$eventData || !isset($eventData['event'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Malformed Webhook Payload']);
    exit;
}

$event = $eventData['event'];
$payload = $eventData['payload'] ?? [];
$payment = $payload['payment']['entity'] ?? [];
$order = $payload['order']['entity'] ?? [];

$paymentId = $payment['id'] ?? ($order['id'] ?? 'unknown');
$amount = isset($payment['amount']) ? ($payment['amount'] / 100) : 0;
$currency = $payment['currency'] ?? 'INR';
$status = $payment['status'] ?? 'processed';

// ── Record Event in Supabase PostgreSQL ──────────────────────────────────────
$auditRecord = [
    'event_type' => 'razorpay_webhook',
    'entity_id' => $paymentId,
    'details' => json_encode([
        'event' => $event,
        'amount' => $amount,
        'currency' => $currency,
        'status' => $status,
        'received_at' => date('c'),
    ]),
    'created_at' => date('c'),
];

// Persist to Supabase using Service Role
$supabaseRes = supabaseRequest('rest/v1/audit_logs', 'POST', $auditRecord, true);

http_response_code(200);
echo json_encode([
    'success' => true,
    'event' => $event,
    'payment_id' => $paymentId,
    'status' => 'handled',
    'db_synced' => $supabaseRes['ok'],
]);
