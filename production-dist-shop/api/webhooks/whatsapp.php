<?php
/**
 * MTJ / AVS ERP — Hostinger Meta WhatsApp Webhook Endpoint
 *
 * Endpoint: /api/webhooks/whatsapp.php
 *
 * Handles Meta Webhook verification handshake (GET) and processes
 * inbound customer / karigar messages and delivery receipts (POST).
 */

require_once __DIR__ . '/../config.php';

// ── GET: Meta Webhook Verification Handshake ─────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode = $_GET['hub_mode'] ?? '';
    $token = $_GET['hub_verify_token'] ?? '';
    $challenge = $_GET['hub_challenge'] ?? '';

    if ($mode === 'subscribe' && $token === $WHATSAPP_VERIFY_TOKEN) {
        http_response_code(200);
        header('Content-Type: text/plain');
        echo $challenge;
        exit;
    }

    http_response_code(403);
    echo 'Forbidden: Invalid verify token';
    exit;
}

// ── POST: Inbound Message / Status Event ─────────────────────────────────────
handleCors();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
}

$rawPayload = file_get_contents('php://input');
$data = json_decode($rawPayload, true);

if (!$data) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

// Process entries
$entries = $data['entry'] ?? [];
$processedEvents = 0;

foreach ($entries as $entry) {
    $changes = $entry['changes'] ?? [];
    foreach ($changes as $change) {
        $val = $change['value'] ?? [];
        $messages = $val['messages'] ?? [];
        $statuses = $val['statuses'] ?? [];

        // Inbound message handling
        foreach ($messages as $msg) {
            $from = $msg['from'] ?? '';
            $msgId = $msg['id'] ?? '';
            $text = $msg['text']['body'] ?? ($msg['type'] ?? 'media');

            // Log inbound message to Supabase audit / communications
            $commRecord = [
                'event_type' => 'whatsapp_inbound_message',
                'entity_id' => $msgId,
                'details' => json_encode([
                    'from' => $from,
                    'text' => $text,
                    'type' => $msg['type'] ?? 'text',
                    'timestamp' => $msg['timestamp'] ?? time(),
                ]),
                'created_at' => date('c'),
            ];
            supabaseRequest('rest/v1/audit_logs', 'POST', $commRecord, true);
            $processedEvents++;
        }

        // Message status updates (sent, delivered, read)
        foreach ($statuses as $st) {
            $msgId = $st['id'] ?? '';
            $status = $st['status'] ?? '';
            $recipientId = $st['recipient_id'] ?? '';

            $statusRecord = [
                'event_type' => 'whatsapp_status_update',
                'entity_id' => $msgId,
                'details' => json_encode([
                    'status' => $status,
                    'recipient' => $recipientId,
                    'timestamp' => $st['timestamp'] ?? time(),
                ]),
                'created_at' => date('c'),
            ];
            supabaseRequest('rest/v1/audit_logs', 'POST', $statusRecord, true);
            $processedEvents++;
        }
    }
}

http_response_code(200);
echo json_encode([
    'success' => true,
    'events_processed' => $processedEvents,
]);
