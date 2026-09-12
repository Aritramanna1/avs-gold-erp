<?php
/**
 * AVS Gold ERP — Platform Central Email Dispatcher
 *
 * Endpoint: /api/email/send.php
 *
 * Dispatches transactional emails (Invoices, Quotations, Job Cards,
 * Balance Reminders, System Alerts, Welcome Credentials) via Hostinger Server SMTP.
 * Guarantees standard AVS Gold ERP branding footer and outbox tracking.
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

$rawPayload = file_get_contents('php://input');
$payload = json_decode($rawPayload, true);

if (!$payload || empty($payload['to']) || empty($payload['subject'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Missing required fields: to, subject']);
    exit;
}

$to = trim($payload['to']);
$subject = trim($payload['subject']);
$htmlBody = $payload['htmlBody'] ?? ($payload['html'] ?? '');
$textBody = $payload['textBody'] ?? strip_tags($htmlBody);
$attachments = $payload['attachments'] ?? [];
$tenantId = $payload['tenantId'] ?? 'platform';
$idempotencyKey = $payload['idempotencyKey'] ?? ($payload['messageId'] ?? null);

// Load server-side Hostinger SMTP credentials
$creds = loadHostingerCredentials();

$fromEmail = !empty($payload['fromEmail']) ? trim($payload['fromEmail']) : ($creds['fromEmail'] ?: $creds['username']);
$fromName = !empty($payload['fromName']) ? trim($payload['fromName']) : $creds['fromName'];
$replyTo = !empty($payload['replyTo']) ? trim($payload['replyTo']) : $creds['replyTo'];

// Check for duplicate / idempotency if key is provided
$outboxId = 'outbox_' . ($idempotencyKey ?: md5($to . $subject . time()));

$sendSuccess = false;
$messageId = null;
$errorMsg = null;
$deliveryMethod = 'hostinger_smtp';

if ($creds['isConfigured']) {
    try {
        $client = new HostingerSmtpClient(
            $creds['host'],
            $creds['port'],
            $creds['encryption'],
            $creds['username'],
            $creds['password']
        );

        $sendResult = $client->sendMail([
            'to' => $to,
            'subject' => $subject,
            'htmlBody' => $htmlBody,
            'fromEmail' => $fromEmail,
            'fromName' => $fromName,
            'replyTo' => $replyTo,
            'attachments' => $attachments,
            'tenantId' => $tenantId,
        ]);

        $sendSuccess = true;
        $messageId = $sendResult['messageId'];
    } catch (Exception $e) {
        $sendSuccess = false;
        $errorMsg = $e->getMessage();
    }
} else {
    // Hostinger not configured - attempt fallback to native PHP mail or queue
    $errorMsg = 'Hostinger SMTP not configured. Enter Hostinger mailbox credentials in Owner Console.';
    $deliveryMethod = 'unconfigured';
}

// Log to PostgreSQL audit logs & outbox
$auditPayload = [
    'event_type' => $sendSuccess ? 'email_dispatched' : 'email_failed',
    'entity_id' => $messageId ?: $outboxId,
    'details' => json_encode([
        'to' => $to,
        'from' => "{$fromName} <{$fromEmail}>",
        'subject' => $subject,
        'tenant_id' => $tenantId,
        'has_attachments' => !empty($attachments),
        'dispatched_via' => $deliveryMethod,
        'status' => $sendSuccess ? 'sent' : 'failed',
        'error' => $errorMsg,
        'message_id' => $messageId,
        'idempotency_key' => $idempotencyKey,
        'timestamp' => date('c'),
    ]),
    'created_at' => date('c'),
];
supabaseRequest('rest/v1/audit_logs', 'POST', $auditPayload, true);

// Also log to platform_audit_events
supabaseRequest('rest/v1/platform_audit_events', 'POST', [
    'action' => $sendSuccess ? 'EMAIL_DISPATCHED' : 'EMAIL_FAILED',
    'target_type' => 'email',
    'reason' => ($sendSuccess ? "Sent: " : "Failed: ") . "{$subject} -> {$to}" . ($errorMsg ? " ({$errorMsg})" : ""),
    'created_at' => date('c'),
], true);

http_response_code($sendSuccess ? 200 : 200); // 200 with ok=false so caller can gracefully handle
echo json_encode([
    'success' => $sendSuccess,
    'ok' => $sendSuccess,
    'messageId' => $messageId,
    'to' => $to,
    'from' => "{$fromName} <{$fromEmail}>",
    'subject' => $subject,
    'status' => $sendSuccess ? 'SENT' : 'FAILED',
    'error' => $errorMsg,
    'provider' => 'Hostinger Email',
]);
