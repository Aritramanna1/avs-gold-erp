<?php
/**
 * AVS ERP — Central Webhook Framework & Dispatcher
 *
 * Endpoint: /api/webhooks/dispatcher.php
 *
 * Standardized architecture supporting:
 * INBOUND WEBHOOK
 * → verification
 * → authentication/signature validation
 * → event identification
 * → idempotency check
 * → queue/process
 * → business handler
 * → audit log
 * → response
 */

require_once __DIR__ . '/../config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];
$provider = strtolower($_GET['provider'] ?? 'generic');
$action = $_GET['action'] ?? 'receive';

// ── 1. Meta WhatsApp Webhook Handshake (GET Verification) ────────────────────
if ($method === 'GET') {
    if ($provider === 'whatsapp') {
        $hubMode = $_GET['hub_mode'] ?? ($_GET['hub.mode'] ?? '');
        $hubToken = $_GET['hub_verify_token'] ?? ($_GET['hub.verify_token'] ?? '');
        $hubChallenge = $_GET['hub_challenge'] ?? ($_GET['hub.challenge'] ?? '');
        $expectedToken = getenv('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?: 'avs_erp_wa_verify_2026';

        if ($hubMode === 'subscribe' && $hubToken === $expectedToken) {
            http_response_code(200);
            header('Content-Type: text/plain');
            echo $hubChallenge;
            exit;
        }

        http_response_code(403);
        echo json_encode(['error' => 'Invalid verify token']);
        exit;
    }

    // Health check for webhook framework
    http_response_code(200);
    echo json_encode([
        'status' => 'active',
        'framework' => 'AVS-Central-Webhook-Engine',
        'provider' => $provider,
        'timestamp' => date('c'),
    ]);
    exit;
}

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$payload = json_decode($rawPayload, true) ?: [];
$startTime = microtime(true);

// ── 2. Admin Retry Action (Triggered from Admin UI) ──────────────────────────
if ($action === 'retry') {
    $eventId = $payload['event_id'] ?? ($_GET['event_id'] ?? '');
    if (empty($eventId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing event_id for retry']);
        exit;
    }

    // Fetch original event from Supabase
    $lookup = supabaseRequest("rest/v1/inbound_webhooks?id=eq.{$eventId}&select=*", 'GET', null, true);
    if (empty($lookup['data'][0])) {
        http_response_code(404);
        echo json_encode(['error' => 'Webhook record not found']);
        exit;
    }

    $webhookRecord = $lookup['data'][0];
    $rawPayloadData = is_string($webhookRecord['raw_payload']) ? json_decode($webhookRecord['raw_payload'], true) : $webhookRecord['raw_payload'];
    $provider = $webhookRecord['provider'];
    $eventType = $webhookRecord['event_type'];

    // Process business logic safely
    $processResult = executeBusinessHandler($provider, $eventType, $rawPayloadData);

    $updatedRetryCount = ((int)($webhookRecord['retry_count'] ?? 0)) + 1;
    $status = $processResult['success'] ? 'processed' : 'failed';

    supabaseRequest("rest/v1/inbound_webhooks?id=eq.{$eventId}", 'PATCH', [
        'status' => $status,
        'retry_count' => $updatedRetryCount,
        'last_error' => $processResult['error'] ?? null,
        'processed_result' => json_encode($processResult),
        'processed_at' => date('c'),
    ], true);

    // Audit log
    supabaseRequest('rest/v1/admin_audit_logs', 'POST', [
        'actor_id' => $payload['actor_id'] ?? 'admin',
        'actor_email' => $payload['actor_email'] ?? 'admin@maatarajewellers.shop',
        'action' => 'webhook_retried',
        'entity_type' => 'webhook',
        'entity_id' => $eventId,
        'result' => $status,
        'created_at' => date('c'),
    ], true);

    echo json_encode([
        'success' => $processResult['success'],
        'message' => $processResult['success'] ? 'Webhook retried and processed successfully' : 'Retry failed',
        'error' => $processResult['error'] ?? null,
        'result' => $processResult,
    ]);
    exit;
}

// ── 3. Signature & Authentication Verification ──────────────────────────────
$signatureVerified = false;
$idempotencyKey = null;
$eventType = 'unknown';

switch ($provider) {
    case 'razorpay':
        $secret = getenv('RAZORPAY_WEBHOOK_SECRET') ?: '';
        $signature = $_SERVER['HTTP_X_RAZORPAY_SIGNATURE'] ?? '';
        if (!empty($secret) && !empty($signature)) {
            $expectedSignature = hash_hmac('sha256', $rawPayload, $secret);
            $signatureVerified = hash_equals($expectedSignature, $signature);
        } else {
            // Permissive in dev if secret not configured
            $signatureVerified = true;
        }

        $eventType = $payload['event'] ?? 'payment.unknown';
        $paymentId = $payload['payload']['payment']['entity']['id'] ?? '';
        $idempotencyKey = 'rzp_' . md5($eventType . '_' . $paymentId . '_' . ($payload['created_at'] ?? time()));
        break;

    case 'whatsapp':
        $appSecret = getenv('WHATSAPP_APP_SECRET') ?: '';
        $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
        if (!empty($appSecret) && !empty($signature)) {
            $expectedSignature = 'sha256=' . hash_hmac('sha256', $rawPayload, $appSecret);
            $signatureVerified = hash_equals($expectedSignature, $signature);
        } else {
            $signatureVerified = true;
        }

        $eventType = 'whatsapp.message_received';
        $msgId = $payload['entry'][0]['changes'][0]['value']['messages'][0]['id'] ?? '';
        $statusId = $payload['entry'][0]['changes'][0]['value']['statuses'][0]['id'] ?? '';
        $idempotencyKey = 'wa_' . md5($msgId . '_' . $statusId . '_' . time());
        break;

    default: // generic / custom webhook
        $authHeader = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
        $expectedKey = getenv('AVS_WEBHOOK_SECRET') ?: '';
        if (!empty($expectedKey)) {
            $signatureVerified = ($authHeader === 'Bearer ' . $expectedKey);
        } else {
            $signatureVerified = true;
        }

        $eventType = $payload['event'] ?? ($payload['type'] ?? 'custom.event');
        $idempotencyKey = $payload['idempotency_key'] ?? ('gen_' . md5($rawPayload . '_' . time()));
        break;
}

if (!$signatureVerified) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid webhook signature or unauthorized']);
    exit;
}

// ── 4. Idempotency Check (Prevent duplicate execution) ──────────────────────
$existing = supabaseRequest("rest/v1/inbound_webhooks?idempotency_key=eq.{$idempotencyKey}&select=id,status", 'GET', null, true);
if (!empty($existing['data'][0])) {
    http_response_code(200);
    echo json_encode([
        'status' => 'duplicate',
        'message' => 'Event already received and processed (idempotent guard)',
        'idempotency_key' => $idempotencyKey,
    ]);
    exit;
}

// ── 5. Process Business Logic ───────────────────────────────────────────────
$processResult = executeBusinessHandler($provider, $eventType, $payload);
$durationMs = (int)round((microtime(true) - $startTime) * 1000);
$status = $processResult['success'] ? 'processed' : 'failed';

// ── 6. Log to Inbound Webhooks in Supabase PostgreSQL ───────────────────────
$logData = [
    'idempotency_key' => $idempotencyKey,
    'provider' => $provider,
    'event_type' => $eventType,
    'status' => $status,
    'signature_verified' => $signatureVerified,
    'raw_payload' => is_array($payload) ? json_encode($payload) : $rawPayload,
    'processed_result' => json_encode($processResult),
    'last_error' => $processResult['error'] ?? null,
    'processing_time_ms' => $durationMs,
    'source_ip' => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
    'processed_at' => date('c'),
];

supabaseRequest('rest/v1/inbound_webhooks', 'POST', $logData, true);

http_response_code($processResult['success'] ? 200 : 500);
echo json_encode([
    'success' => $processResult['success'],
    'provider' => $provider,
    'event_type' => $eventType,
    'idempotency_key' => $idempotencyKey,
    'duration_ms' => $durationMs,
    'result' => $processResult,
]);
exit;

// ── Helper: Business Event Dispatcher ───────────────────────────────────────
function executeBusinessHandler(string $provider, string $eventType, array $payload): array {
    try {
        switch ($provider) {
            case 'razorpay':
                if (strpos($eventType, 'payment.captured') !== false || strpos($eventType, 'order.paid') !== false) {
                    $entity = $payload['payload']['payment']['entity'] ?? [];
                    $orderId = $entity['order_id'] ?? '';
                    $amount = ($entity['amount'] ?? 0) / 100;
                    $email = $entity['email'] ?? '';
                    $contact = $entity['contact'] ?? '';

                    // Record payment receipt in audit trail
                    supabaseRequest('rest/v1/audit_logs', 'POST', [
                        'event_type' => 'online_payment_received',
                        'entity_id' => $orderId,
                        'details' => json_encode([
                            'amount' => $amount,
                            'provider' => 'razorpay',
                            'payment_id' => $entity['id'] ?? '',
                            'contact' => $contact,
                            'email' => $email,
                        ]),
                        'created_at' => date('c'),
                    ], true);

                    return ['success' => true, 'action' => 'payment_recorded', 'amount' => $amount];
                }
                return ['success' => true, 'action' => 'ignored_event_type'];

            case 'whatsapp':
                $entry = $payload['entry'][0]['changes'][0]['value'] ?? [];
                if (!empty($entry['messages'])) {
                    $msg = $entry['messages'][0];
                    $from = $msg['from'] ?? '';
                    $body = $msg['text']['body'] ?? ($msg['type'] ?? 'media');

                    supabaseRequest('rest/v1/audit_logs', 'POST', [
                        'event_type' => 'inbound_whatsapp_message',
                        'entity_id' => 'wa_' . ($msg['id'] ?? time()),
                        'details' => json_encode(['from' => $from, 'body' => $body]),
                        'created_at' => date('c'),
                    ], true);

                    return ['success' => true, 'action' => 'message_logged', 'from' => $from];
                }
                return ['success' => true, 'action' => 'status_update_logged'];

            default:
                // Generic custom event
                return ['success' => true, 'action' => 'generic_event_acknowledged', 'event' => $eventType];
        }
    } catch (\Throwable $t) {
        return ['success' => false, 'error' => $t->getMessage()];
    }
}
