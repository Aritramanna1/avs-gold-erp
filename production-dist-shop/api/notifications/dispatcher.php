<?php
/**
 * AVS ERP — Central Notification Engine Dispatcher
 *
 * Endpoint: /api/notifications/dispatcher.php
 *
 * Architecture:
 * ERP EVENT
 *   ↓
 * EVENT ENGINE
 *   ↓
 * NOTIFICATION RULE
 *   ├── Email (Hostinger Server SMTP)
 *   ├── In-App Alert
 *   ├── Webhook Relay
 *   └── Audit Log
 */

require_once __DIR__ . '/../config.php';
handleCors();

$method = $_SERVER['REQUEST_METHOD'];

if ($method !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$payload = json_decode($rawPayload, true) ?: [];

$eventType = $payload['event_type'] ?? 'system.notice';
$tenantId = $payload['tenant_id'] ?? 'tenant_default';
$recipient = $payload['recipient'] ?? 'admin@maatarajewellers.shop';
$subject = $payload['subject'] ?? 'AVS ERP Notification';
$body = $payload['body'] ?? '';
$eventId = $payload['event_id'] ?? ('notif_' . md5($eventType . '_' . $recipient . '_' . date('YmdH')));

// ── Idempotency / Deduplication Check ───────────────────────────────────────
$existing = supabaseRequest("rest/v1/notification_logs?idempotency_key=eq.{$eventId}&select=id", 'GET', null, true);
if (!empty($existing['data'][0])) {
    http_response_code(200);
    echo json_encode([
        'status' => 'suppressed',
        'message' => 'Duplicate notification suppressed (anti-alert spam guard)',
        'idempotency_key' => $eventId,
    ]);
    exit;
}

// ── 1. Dispatch Email via Hostinger Server-Side Infrastructure ──────────────
$headers = "Content-Type: text/html; charset=UTF-8\r\nFrom: AVS ERP System <no-reply@maatarajewellers.shop>";
$mailSent = @mail($recipient, $subject, "<div style='font-family:sans-serif;padding:20px;border:1px solid #E2E8F0;border-radius:8px;'><h3>{$subject}</h3><p>{$body}</p></div>", $headers);

// ── 2. Log to Supabase PostgreSQL Notification Log ──────────────────────────
$logEntry = [
    'tenant_id' => $tenantId,
    'idempotency_key' => $eventId,
    'event_type' => $eventType,
    'channel' => 'email',
    'recipient' => $recipient,
    'subject' => $subject,
    'body_snippet' => substr(strip_tags($body), 0, 200),
    'status' => $mailSent ? 'delivered' : 'queued',
    'metadata' => json_encode($payload['metadata'] ?? []),
    'created_at' => date('c'),
];

supabaseRequest('rest/v1/notification_logs', 'POST', $logEntry, true);

http_response_code(200);
echo json_encode([
    'success' => true,
    'event_id' => $eventId,
    'event_type' => $eventType,
    'delivered' => $mailSent,
    'timestamp' => date('c'),
]);
